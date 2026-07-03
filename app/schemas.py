"""Pydantic request/response models."""

from pydantic import BaseModel, Field


class CheckoutRequest(BaseModel):
    amount: float = Field(..., description="Tip amount in whole currency units, e.g. 5 for £5")
    creator: str | None = Field(default=None, max_length=80)
    message: str | None = Field(default=None, max_length=500)
