"""add notes to calls

Revision ID: 0002
Revises: 0001
Create Date: 2026-06-16
"""
from alembic import op
import sqlalchemy as sa

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("calls", sa.Column("notes", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("calls", "notes")
