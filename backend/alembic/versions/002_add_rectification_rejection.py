"""add rectification rejection fields and evidence files

Revision ID: 002_add_rectification_rejection
Revises: 001_initial_baseline
Create Date: 2026-05-03

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '002_add_rectification_rejection'
down_revision = '001_initial_baseline'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('rectifications', sa.Column('rejection_reason', sa.Text(), nullable=True))
    op.add_column('rectifications', sa.Column('rejected_at', sa.DateTime(), nullable=True))
    op.add_column('rectifications', sa.Column('rejected_by', sa.Uuid(), nullable=True))
    op.add_column('rectifications', sa.Column('evidence_file_ids', sa.JSON(), nullable=True, server_default='[]'))


def downgrade() -> None:
    op.drop_column('rectifications', 'evidence_file_ids')
    op.drop_column('rectifications', 'rejected_by')
    op.drop_column('rectifications', 'rejected_at')
    op.drop_column('rectifications', 'rejection_reason')
