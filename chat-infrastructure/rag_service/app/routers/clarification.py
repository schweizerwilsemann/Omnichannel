from __future__ import annotations

from typing import List

from fastapi import APIRouter, Depends, HTTPException

from ..schemas import ClarificationPredictRequest, ClarificationPredictResponse
from ..services.clarification import get_clarification_model
from .dependencies import require_admin_key

router = APIRouter(prefix="/clarification", tags=["Clarification"], dependencies=[Depends(require_admin_key)])


@router.post("/predict", response_model=ClarificationPredictResponse)
async def predict_clarification(request: ClarificationPredictRequest) -> ClarificationPredictResponse:
    bundle = get_clarification_model()
    feature_map = request.features or {}

    feature_values: List[float] = []
    missing: List[str] = []

    for name in bundle.feature_cols:
        raw_value = feature_map.get(name)
        if raw_value is None:
            missing.append(name)
            raw_value = 0.0
        try:
            feature_values.append(float(raw_value))
        except (TypeError, ValueError) as exc:
            raise HTTPException(
                status_code=400,
                detail=f"Feature '{name}' could not be converted to float (value={raw_value!r}): {exc}"
            ) from exc

    pipeline = bundle.pipeline
    try:
        predictions = pipeline.predict([feature_values])
        prediction = int(predictions[0])
    except Exception as exc:  # pragma: no cover
        raise HTTPException(status_code=500, detail=f"Clarification model prediction failed: {exc}") from exc

    probability = float(prediction)
    if hasattr(pipeline, "predict_proba"):
        try:
            proba = pipeline.predict_proba([feature_values])
            if proba.ndim == 2:
                if proba.shape[1] > 1:
                    probability = float(proba[0][1])
                else:
                    probability = float(proba[0][0])
        except Exception:  # pragma: no cover
            probability = float(prediction)

    return ClarificationPredictResponse(
        prediction=prediction,
        probability=probability,
        feature_order=bundle.feature_cols,
        feature_values=feature_values,
        missing_features=missing,
        model_metadata=bundle.training_metadata
    )
