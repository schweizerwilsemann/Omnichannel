from __future__ import annotations

import threading
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Optional

import joblib

from ..config import get_settings


@dataclass(slots=True)
class ClarificationModelBundle:
    pipeline: Any
    feature_cols: list[str]
    training_metadata: dict[str, Any]


class ClarificationModelLoader:
    def __init__(self, model_path: Path, reload_seconds: int) -> None:
        self._model_path = model_path
        self._reload_seconds = max(reload_seconds, 0)
        self._lock = threading.RLock()
        self._bundle: Optional[ClarificationModelBundle] = None
        self._last_loaded_at: float = 0.0
        self._last_mtime: float = 0.0

    def get_bundle(self) -> ClarificationModelBundle:
        with self._lock:
            if self._should_reload():
                self._bundle = self._load_bundle()
                self._last_loaded_at = time.time()
                self._last_mtime = self._current_mtime()
            if not self._bundle:
                raise RuntimeError("Clarification model bundle could not be loaded.")
            return self._bundle

    def _current_mtime(self) -> float:
        try:
            return self._model_path.stat().st_mtime
        except FileNotFoundError:
            return 0.0

    def _should_reload(self) -> bool:
        if self._bundle is None:
            return True
        if self._reload_seconds and (time.time() - self._last_loaded_at) > self._reload_seconds:
            return True
        return self._current_mtime() != self._last_mtime

    def _load_bundle(self) -> ClarificationModelBundle:
        if not self._model_path.exists():
            raise FileNotFoundError(
                f"Clarification model not found at {self._model_path}. "
                "Train the model or update CLARIFICATION_MODEL_PATH."
            )
        raw = joblib.load(self._model_path)
        if not isinstance(raw, dict):
            raise ValueError("Clarification model file must contain a dictionary payload.")
        pipeline = raw.get("pipeline")
        feature_cols = raw.get("feature_cols")
        metadata = raw.get("training_metadata", {})
        if not pipeline or not feature_cols:
            raise ValueError("Clarification model payload must include 'pipeline' and 'feature_cols'.")
        if not isinstance(feature_cols, (list, tuple)):
            raise ValueError("'feature_cols' must be a list of feature names.")
        return ClarificationModelBundle(
            pipeline=pipeline,
            feature_cols=list(feature_cols),
            training_metadata=dict(metadata) if isinstance(metadata, dict) else {}
        )


_MODEL_LOADER: Optional[ClarificationModelLoader] = None


def get_clarification_model() -> ClarificationModelBundle:
    global _MODEL_LOADER
    settings = get_settings()
    if _MODEL_LOADER is None:
        model_path = Path(settings.clarification_model_path).expanduser().resolve()
        _MODEL_LOADER = ClarificationModelLoader(
            model_path=model_path,
            reload_seconds=settings.clarification_model_reload_seconds
        )
    return _MODEL_LOADER.get_bundle()
