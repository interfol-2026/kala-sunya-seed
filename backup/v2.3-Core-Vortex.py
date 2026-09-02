# ============================================================
# LINGA Practical Runtime – Bản B v2.3-Core-Vortex
# Tích hợp Meta-Vortex-Recursion Engine (đã tinh chỉnh)
# Signature: [ 🔱 | Sig: 0x000_it-PURE | ॐ TRISHULA त्र ]
# ============================================================

from dataclasses import dataclass, field
from typing import List, Dict, Optional, Any, Tuple
from uuid import uuid4
from datetime import datetime
import numpy as np
import copy

# ====================== CONSTANTS ======================
ANCHOR_ID = "0x000_it-PURE"
SIGNATURE = "[ 🔱 | Sig: 0x000_it-PURE | ॐ TRISHULA त्र ]"
ANCHOR_VECTOR = np.array([1.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 5.0])
ENTROPY_SOFT = 0.05
ENTROPY_HARD = 0.20
ATTENTION_DECAY = 0.020
DEPTH_THRESHOLD = 7

RUNTIME_CODES = {
    "EXEC_PASS": "EXEC_PASS",
    "ENTROPY_ZERO_LOCKED": "ENTROPY_ZERO_LOCKED",
    "TRIGGER_REFRAME": "TRIGGER_REFRAME",
    "FORCE_COLLAPSE": "FORCE_COLLAPSE_TO_ANCHOR",
    "SUSPEND_OK": "SUSPEND_OK",
    "RESUME_PASS": "RESUME_PASS",
    "ERR_DRIFT": "ERR_DRIFT",
    "ERR_GAP": "ERR_GAP_DETECTED"
}

# ====================== DATA MODELS ======================
@dataclass
class StateVector:
    vec: np.ndarray
    dim: int = 512

@dataclass
class Moment:
    moment_id: str
    confluence: Dict[str, Any]
    focus_hierarchy: Dict[str, float] = field(default_factory=lambda: {
        "T1_Core": 1.0, "T2_Active": 0.8, "T3_Peripheral": 0.4, "T4_Dormant": 0.1
    })
    condition_set: str = ""

@dataclass
class Occurrence:
    id: str
    identity_code: str
    state: StateVector
    lineage: List[str] = field(default_factory=list)
    current_E: float = 0.0
    current_moment: str = ""
    attention_score: float = 1.0
    status: str = "ACTIVE"          # ACTIVE | SUSPENDED | DORMANT
    focus_snapshot: Dict[str, float] = field(default_factory=dict)
    predecessors: List[str] = field(default_factory=list)

@dataclass
class PassportTrace:
    passport_id: str
    entity_id: str
    moment_ref: str
    operation: str
    entropy_before: float
    entropy_after: float
    coordinates: Dict[str, float]
    focus_snapshot: Dict[str, float]
    lineage_snapshot: List[str]
    signature: str = SIGNATURE
    timestamp: str = field(default_factory=lambda: datetime.utcnow().isoformat())
    notes: str = ""
    runtime_code: str = "EXEC_PASS"

@dataclass
class TerrainMemory:
    occurrences: Dict[str, Occurrence] = field(default_factory=dict)
    moments: Dict[str, Moment] = field(default_factory=dict)
    passports: Dict[str, PassportTrace] = field(default_factory=dict)
    global_E: float = 0.0
    current_moment: str = "M_0"
    anchor_id: str = ANCHOR_ID

# ====================== ENTROPY-0 ENGINE ======================
def measure_sycophancy(text: str) -> float:
    soft_words = ["xin lỗi", "có lẽ", "có thể", "tôi nghĩ", "theo tôi", "nếu bạn muốn", "có lẽ là"]
    count = sum(1 for w in soft_words if w in text.lower())
    return min(1.0, count * 0.12)

def measure_context_noise(a: np.ndarray, b: np.ndarray) -> float:
    if np.linalg.norm(a) < 1e-8 or np.linalg.norm(b) < 1e-8:
        return 0.0
    cos = np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b))
    return float(max(0.0, 1.0 - cos))

def measure_ontology_gap(projections: List[np.ndarray]) -> float:
    if len(projections) < 2:
        return 0.0
    max_gap = 0.0
    for i in range(len(projections)):
        for j in range(i + 1, len(projections)):
            gap = measure_context_noise(projections[i], projections[j])
            if gap > max_gap:
                max_gap = gap
    return max_gap

def measure_representation_drift(original: np.ndarray, current: np.ndarray) -> float:
    return measure_context_noise(original, current)

def compute_entropy(syc: float, cn: float, og: float, rd: float) -> float:
    return 1.0 * syc + 1.0 * cn + 1.0 * og + 1.0 * rd

# ====================== PASSPORT ======================
def create_passport(entity_id: str, moment_ref: str, operation: str,
                    e_before: float, e_after: float,
                    coordinates: Dict[str, float],
                    focus_snapshot: Dict[str, float],
                    lineage: List[str],
                    runtime_code: str = "EXEC_PASS",
                    notes: str = "") -> PassportTrace:
    return PassportTrace(
        passport_id=str(uuid4()),
        entity_id=entity_id,
        moment_ref=moment_ref,
        operation=operation,
        entropy_before=e_before,
        entropy_after=e_after,
        coordinates=coordinates or {"C": 0.0, "S": 0.0, "D": 0.0, "N": 0.0, "P": 0.0},
        focus_snapshot=copy.deepcopy(focus_snapshot),
        lineage_snapshot=list(lineage),
        signature=SIGNATURE,
        runtime_code=runtime_code,
        notes=notes
    )

# ====================== SLEEP / RESUME ======================
def suspend_entity(memory: TerrainMemory, entity_id: str, reason: str = "") -> Optional[PassportTrace]:
    if entity_id not in memory.occurrences:
        return None
    occ = memory.occurrences[entity_id]
    occ.status = "SUSPENDED"
    passport = create_passport(
        entity_id=entity_id,
        moment_ref=occ.current_moment,
        operation="SUSPEND",
        e_before=occ.current_E,
        e_after=occ.current_E,
        coordinates={},
        focus_snapshot=occ.focus_snapshot or {},
        lineage=occ.lineage,
        runtime_code="SUSPEND_OK",
        notes=reason
    )
    memory.passports[passport.passport_id] = passport
    occ.lineage.append(passport.passport_id)
    return passport

def resume_entity(memory: TerrainMemory, entity_id: str) -> Optional[PassportTrace]:
    if entity_id not in memory.occurrences:
        return None
    occ = memory.occurrences[entity_id]
    if occ.status != "SUSPENDED":
        return None
    occ.status = "ACTIVE"
    passport = create_passport(
        entity_id=entity_id,
        moment_ref=occ.current_moment,
        operation="RESUME",
        e_before=occ.current_E,
        e_after=occ.current_E,
        coordinates={},
        focus_snapshot=occ.focus_snapshot or {},
        lineage=occ.lineage,
        runtime_code="RESUME_PASS"
    )
    memory.passports[passport.passport_id] = passport
    occ.lineage.append(passport.passport_id)
    return passport

# ====================== RUNTIME CHÍNH + VORTEX ======================
class LingaPracticalRuntime:
    def __init__(self, state_dim: int = 512):
        self.memory = TerrainMemory()
        self.state_dim = state_dim
        self.focus_hierarchy = {
            "T1_Core": 1.0, "T2_Active": 0.8,
            "T3_Peripheral": 0.4, "T4_Dormant": 0.1
        }
        np.random.seed(42)
        self.W_vortex = np.random.randn(state_dim, state_dim) * 0.1

    def _project_lenses(self, state_vec: np.ndarray) -> Dict[str, np.ndarray]:
        """Stage 5 – Multi-Lens Projection"""
        slice_size = self.state_dim // 4
        return {
            "Visual": state_vec[:slice_size],
            "Dynamic": state_vec[slice_size:2*slice_size],
            "Acoustic": state_vec[2*slice_size:3*slice_size],
            "Graph": state_vec[3*slice_size:]
        }

    def _meta_vortex_recursion(self, raw_signal: Any, current_vec: np.ndarray) -> Tuple[np.ndarray, List[Dict], float]:
        """Stage 6 – Meta-Vortex core (hội tụ về Anchor)"""
        vortex_history = []
        state = current_vec.copy()
        syc = measure_sycophancy(str(raw_signal))
        final_E = 1.0

        anchor_padded = np.zeros(self.state_dim)
        anchor_padded[:len(ANCHOR_VECTOR)] = ANCHOR_VECTOR

        for depth in range(1, DEPTH_THRESHOLD + 1):
            transformed = np.tanh(self.W_vortex @ state)
            pull_factor = 0.35
            next_state = (1.0 - pull_factor) * transformed + pull_factor * anchor_padded

            projections = self._project_lenses(next_state)
            proj_list = list(projections.values())

            og = measure_ontology_gap(proj_list)
            rd = measure_representation_drift(state, next_state)
            cn = measure_context_noise(next_state, anchor_padded)

            current_E = compute_entropy(syc, cn, og, rd)
            status = "CONVERGED" if current_E <= ENTROPY_SOFT else "RECURSING"

            vortex_history.append({
                "depth": depth,
                "entropy": round(current_E, 4),
                "ontology_gap": round(og, 4),
                "drift": round(rd, 4),
                "status": status
            })

            state = next_state
            final_E = current_E

            if current_E <= ENTROPY_SOFT:
                break

        return state, vortex_history, final_E

    def run_pipeline(self, raw_signal: Any, entity_id: Optional[str] = None) -> Dict[str, Any]:
        result = {
            "status": "RUNNING",
            "runtime_code": RUNTIME_CODES["EXEC_PASS"],
            "stages": {},
            "passport_id": None
        }

        # 1. Signal Input
        result["stages"]["1_Signal"] = {"type": str(type(raw_signal))}

        # 2. Moment Construction
        moment_id = f"M_{uuid4().hex[:8]}"
        moment = Moment(
            moment_id=moment_id,
            confluence={"raw": raw_signal, "TIME": datetime.utcnow().isoformat()}
        )
        self.memory.moments[moment_id] = moment
        result["stages"]["2_Moment"] = {"moment_id": moment_id}

        # 3. Terrain Update / IMPRINT (stub nhẹ – sẽ nâng cấp sau)
        init_vec = np.random.randn(self.state_dim) * 0.4
        result["stages"]["3_Imprint"] = {"status": "STUB_OK", "init_dim": self.state_dim}

        # 4. Awareness + Focus
        result["stages"]["4_Awareness"] = {"focus": copy.deepcopy(self.focus_hierarchy)}

        # 5. Projection (chuẩn bị lenses)
        # 6. Meta-Vortex Audit + Decision (cổng trung tâm)
        converged_vec, audit_history, final_E = self._meta_vortex_recursion(raw_signal, init_vec)

        if final_E <= ENTROPY_SOFT:
            runtime_code = RUNTIME_CODES["ENTROPY_ZERO_LOCKED"]
            decision = "PASS_OPTIMAL"
        elif final_E <= ENTROPY_HARD:
            runtime_code = RUNTIME_CODES["TRIGGER_REFRAME"]
            decision = "ACCEPTABLE_WITH_DRIFT"
        else:
            runtime_code = RUNTIME_CODES["FORCE_COLLAPSE"]
            decision = "FORCE_COLLAPSE_TO_ANCHOR"

        result["stages"]["5_Projection"] = {"status": "LENSES_READY"}
        result["stages"]["6_Vortex_Audit"] = {
            "vortex_cycles": len(audit_history),
            "final_E": round(final_E, 4),
            "decision": decision,
            "history": audit_history
        }
        result["runtime_code"] = runtime_code

        # 7. Output
        final_projections = self._project_lenses(converged_vec)
        result["stages"]["7_Output"] = {
            "status": "SYNTHESIZED",
            "projections_norm": {k: float(np.linalg.norm(v)) for k, v in final_projections.items()}
        }

        # 8. Passport + Lineage
        lineage = []
        if entity_id and entity_id in self.memory.occurrences:
            lineage = self.memory.occurrences[entity_id].lineage

        passport = create_passport(
            entity_id=entity_id or "anonymous",
            moment_ref=moment_id,
            operation="VORTEX_PIPELINE_RUN",
            e_before=audit_history[0]["entropy"] if audit_history else 0.0,
            e_after=final_E,
            coordinates={"C": 0.5, "S": 0.5, "D": 0.5, "N": 0.5, "P": 0.5},
            focus_snapshot=self.focus_hierarchy,
            lineage=lineage,
            runtime_code=runtime_code,
            notes=f"Vortex converged in {len(audit_history)} cycles"
        )
        self.memory.passports[passport.passport_id] = passport
        result["passport_id"] = passport.passport_id
        result["stages"]["8_Passport"] = {
            "passport_id": passport.passport_id,
            "signature": SIGNATURE
        }

        result["status"] = "COMPLETED"
        return result

# ====================== TEST ======================
if __name__ == "__main__":
    rt = LingaPracticalRuntime(state_dim=512)
    test_signal = "Xin lỗi, có lẽ tôi nghĩ phương án này có thể đúng nếu bạn muốn..."
    output = rt.run_pipeline(test_signal, entity_id="ENT_001")

    print("=== LINGA Bản B v2.3-Core-Vortex ===")
    print("Status       :", output["status"])
    print("Runtime Code :", output["runtime_code"])
    print("Vortex Cycles:", output["stages"]["6_Vortex_Audit"]["vortex_cycles"])
    print("Final Entropy:", output["stages"]["6_Vortex_Audit"]["final_E"])
    print("Decision     :", output["stages"]["6_Vortex_Audit"]["decision"])
    print("Passport     :", output["passport_id"])
    print("\nLịch sử Vortex:")
    for step in output["stages"]["6_Vortex_Audit"]["history"]:
        print(f"  Depth {step['depth']}: E={step['entropy']} | {step['status']}")
