from __future__ import annotations
from collections import defaultdict

import numpy as np
from scipy.optimize import minimize as scipy_minimize

from .. import config
from .models import Section, VariableMapping, ScheduleResult
from .qubo import sections_conflict


def qubo_to_ising(Q: np.ndarray) -> tuple[dict[tuple[int, ...], float], float]:
    """Convert QUBO matrix Q to Ising model coefficients.

    x_i = (1 - z_i) / 2 substitution.
    Returns (coefficients dict, constant offset).
    Keys: (i,) for linear, (i,j) for quadratic.
    """
    n = Q.shape[0]
    offset = 0.0
    linear: dict[int, float] = defaultdict(float)
    quadratic: dict[tuple[int, int], float] = defaultdict(float)

    for i in range(n):
        offset += Q[i, i] / 4.0
        linear[i] -= Q[i, i] / 4.0

    for i in range(n):
        for j in range(i + 1, n):
            val = Q[i, j]
            if abs(val) < 1e-12:
                continue
            offset += val / 4.0
            linear[i] -= val / 4.0
            linear[j] -= val / 4.0
            quadratic[(i, j)] = val / 4.0

    coeffs: dict[tuple[int, ...], float] = {}
    for i, v in linear.items():
        if abs(v) > 1e-12:
            coeffs[(i,)] = v
    for (i, j), v in quadratic.items():
        if abs(v) > 1e-12:
            coeffs[(i, j)] = v

    return coeffs, offset


def _ising_energy(z_vals: list[int], coeffs: dict[tuple[int, ...], float], offset: float) -> float:
    energy = offset
    for key, coeff in coeffs.items():
        if len(key) == 1:
            energy += coeff * z_vals[key[0]]
        else:
            energy += coeff * z_vals[key[0]] * z_vals[key[1]]
    return energy


def _z_to_x(z_vals: list[int]) -> list[int]:
    return [(1 - z) // 2 for z in z_vals]


def solve_qaoa(
    Q: np.ndarray,
    sections: list[Section],
    variable_map: list[VariableMapping],
    course_ids: list[str],
    num_results: int = 5,
) -> list[ScheduleResult]:
    n = Q.shape[0]
    coeffs, offset = qubo_to_ising(Q)

    try:
        from qiskit.circuit import QuantumCircuit, Parameter
        from qiskit_aer import AerSimulator
    except ImportError:
        return _simulate_qaoa_numpy(Q, n, sections, variable_map, course_ids, num_results, coeffs, offset)

    return _simulate_qaoa_numpy(Q, n, sections, variable_map, course_ids, num_results, coeffs, offset)


def _simulate_qaoa_numpy(
    Q: np.ndarray,
    n: int,
    sections: list[Section],
    variable_map: list[VariableMapping],
    course_ids: list[str],
    num_results: int,
    coeffs: dict[tuple[int, ...], float],
    offset: float,
) -> list[ScheduleResult]:
    """QAOA simulation using direct statevector evolution with NumPy.
    For n <= 20 qubits, this is tractable and avoids Qiskit circuit overhead.
    """
    p = config.QAOA_DEPTH
    num_states = 2 ** n

    if n > 20:
        return _sample_qaoa(Q, n, sections, variable_map, course_ids, num_results, coeffs, offset)

    cost_diag = np.zeros(num_states)
    for state_int in range(num_states):
        z_vals = [1 - 2 * ((state_int >> i) & 1) for i in range(n)]
        cost_diag[state_int] = _ising_energy(z_vals, coeffs, offset)

    cost_phase = np.exp(-1j * cost_diag)

    mixer_matrices = []
    for qubit in range(n):
        mixer_matrices.append(_build_single_qubit_mixer(n, qubit))

    def qaoa_cost(params):
        gammas = params[:p]
        betas = params[p:]

        state = np.ones(num_states, dtype=complex) / np.sqrt(num_states)

        for layer in range(p):
            state *= np.exp(-1j * gammas[layer] * cost_diag)

            for qubit in range(n):
                state = _apply_rx_mixer(state, n, qubit, betas[layer])

        probs = np.abs(state) ** 2
        return np.sum(probs * cost_diag)

    best_result = None
    best_cost = float("inf")

    for trial in range(3):
        rng = np.random.RandomState(42 + trial)
        init_params = rng.uniform(0, np.pi, 2 * p)

        result = scipy_minimize(
            qaoa_cost,
            init_params,
            method="COBYLA",
            options={"maxiter": config.QAOA_MAX_ITER},
        )

        if result.fun < best_cost:
            best_cost = result.fun
            best_result = result

    gammas = best_result.x[:p]
    betas = best_result.x[p:]
    state = np.ones(num_states, dtype=complex) / np.sqrt(num_states)
    for layer in range(p):
        state *= np.exp(-1j * gammas[layer] * cost_diag)
        for qubit in range(n):
            state = _apply_rx_mixer(state, n, qubit, betas[layer])

    probs = np.abs(state) ** 2
    top_indices = np.argsort(probs)[::-1]

    schedules = []
    seen_bitstrings = set()

    for idx in top_indices:
        if len(schedules) >= num_results:
            break

        bits = [(idx >> i) & 1 for i in range(n)]
        bitstring = "".join(str(b) for b in bits)

        if bitstring in seen_bitstrings:
            continue
        seen_bitstrings.add(bitstring)

        selected = [sections[i] for i, b in enumerate(bits) if b == 1]

        course_count: dict[str, int] = defaultdict(int)
        for s in selected:
            course_count[s.course_id] += 1

        valid = True
        for cid in course_ids:
            if course_count.get(cid, 0) != 1:
                valid = False
                break

        if not valid:
            continue

        conflict = False
        for a_idx in range(len(selected)):
            for b_idx in range(a_idx + 1, len(selected)):
                if sections_conflict(selected[a_idx], selected[b_idx]):
                    conflict = True
                    break
            if conflict:
                break

        if conflict:
            continue

        prof_score = sum(s.professor_rating for s in selected) / len(selected)
        energy = float(np.dot(bits, Q @ bits))

        schedules.append(ScheduleResult(
            sections=selected,
            total_score=-energy,
            professor_score=prof_score,
            walking_score=0.0,
            time_score=0.0,
            solver="qaoa",
            bitstring=bitstring,
        ))

    return schedules


def _apply_rx_mixer(state: np.ndarray, n: int, qubit: int, beta: float) -> np.ndarray:
    """Apply e^{-i * beta * X_qubit} to statevector."""
    cos_b = np.cos(beta)
    sin_b = -1j * np.sin(beta)

    new_state = np.copy(state)
    step = 1 << qubit

    for i in range(len(state)):
        if (i >> qubit) & 1 == 0:
            j = i | step
            s0 = state[i]
            s1 = state[j]
            new_state[i] = cos_b * s0 + sin_b * s1
            new_state[j] = sin_b * s0 + cos_b * s1

    return new_state


def _build_single_qubit_mixer(n: int, qubit: int) -> None:
    pass


def _sample_qaoa(
    Q: np.ndarray,
    n: int,
    sections: list[Section],
    variable_map: list[VariableMapping],
    course_ids: list[str],
    num_results: int,
    coeffs: dict[tuple[int, ...], float],
    offset: float,
) -> list[ScheduleResult]:
    """For large n (>20), use random sampling with QAOA-inspired scoring."""
    rng = np.random.RandomState(42)
    candidates: list[tuple[float, list[int]]] = []

    course_sections: dict[str, list[int]] = defaultdict(list)
    for i, s in enumerate(sections):
        course_sections[s.course_id].append(i)

    for _ in range(config.QAOA_SHOTS):
        bits = [0] * n
        for cid in course_ids:
            indices = course_sections[cid]
            if indices:
                chosen = rng.choice(indices)
                bits[chosen] = 1

        energy = float(np.array(bits) @ Q @ np.array(bits))
        candidates.append((energy, bits))

    candidates.sort(key=lambda x: x[0])

    schedules = []
    seen = set()

    for energy, bits in candidates:
        if len(schedules) >= num_results:
            break

        bs = "".join(str(b) for b in bits)
        if bs in seen:
            continue
        seen.add(bs)

        selected = [sections[i] for i, b in enumerate(bits) if b == 1]

        conflict = False
        for a in range(len(selected)):
            for b in range(a + 1, len(selected)):
                if sections_conflict(selected[a], selected[b]):
                    conflict = True
                    break
            if conflict:
                break
        if conflict:
            continue

        prof_score = sum(s.professor_rating for s in selected) / max(len(selected), 1)
        schedules.append(ScheduleResult(
            sections=selected,
            total_score=-energy,
            professor_score=prof_score,
            walking_score=0.0,
            time_score=0.0,
            solver="qaoa",
            bitstring=bs,
        ))

    return schedules
