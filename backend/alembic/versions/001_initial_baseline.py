"""initial baseline migration

Revision ID: 001_initial_baseline
Revises: None
Create Date: 2026-04-28

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '001_initial_baseline'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # =====================
    # units
    # =====================
    op.create_table(
        'units',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('name', sa.String(256), nullable=False),
        sa.Column('org_code', sa.String(32), unique=True, nullable=False),
        sa.Column('parent_id', sa.String(36), sa.ForeignKey('units.id', ondelete='CASCADE'), index=True),
        sa.Column('unit_type', sa.String(32)),
        sa.Column('level', sa.String(20)),
        sa.Column('sort_order', sa.Integer, default=0),
        sa.Column('tags', sa.JSON, default=dict),
        sa.Column('business_tags', sa.JSON, default=list),
        sa.Column('profile', sa.Text),
        sa.Column('leadership', sa.JSON),
        sa.Column('contact', sa.JSON),
        sa.Column('last_inspection_year', sa.Integer),
        sa.Column('inspection_history', sa.String(1000)),
        sa.Column('is_active', sa.Boolean, default=True),
        sa.Column('created_at', sa.DateTime, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime, server_default=sa.func.now(), onupdate=sa.func.now()),
    )
    op.create_index(op.f('ix_units_org_code'), 'units', ['org_code'], unique=True)
    op.create_index(op.f('ix_units_parent_id'), 'units', ['parent_id'])

    # =====================
    # roles
    # =====================
    op.create_table(
        'roles',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('name', sa.String(64), unique=True, nullable=False),
        sa.Column('code', sa.String(64), unique=True, nullable=False),
        sa.Column('description', sa.String(256)),
        sa.Column('is_active', sa.Boolean, default=True),
        sa.Column('permissions', sa.JSON, default=list),
        sa.Column('created_at', sa.DateTime, server_default=sa.func.now()),
    )
    op.create_index(op.f('ix_roles_code'), 'roles', ['code'], unique=True)
    op.create_index(op.f('ix_roles_name'), 'roles', ['name'], unique=True)

    # =====================
    # permissions
    # =====================
    op.create_table(
        'permissions',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('code', sa.String(64), unique=True, nullable=False),
        sa.Column('name', sa.String(128), nullable=False),
        sa.Column('description', sa.String(256)),
        sa.Column('created_at', sa.DateTime, server_default=sa.func.now()),
    )
    op.create_index(op.f('ix_permissions_code'), 'permissions', ['code'], unique=True)

    # =====================
    # user_roles (association)
    # =====================
    op.create_table(
        'user_roles',
        sa.Column('user_id', sa.String(36), sa.ForeignKey('users.id', ondelete='CASCADE'), primary_key=True),
        sa.Column('role_id', sa.String(36), sa.ForeignKey('roles.id', ondelete='CASCADE'), primary_key=True),
    )
    op.create_index(op.f('ix_user_roles_role_id'), 'user_roles', ['role_id'])

    # =====================
    # role_permissions (association)
    # =====================
    op.create_table(
        'role_permissions',
        sa.Column('role_id', sa.String(36), sa.ForeignKey('roles.id', ondelete='CASCADE'), primary_key=True),
        sa.Column('permission_id', sa.String(36), sa.ForeignKey('permissions.id', ondelete='CASCADE'), primary_key=True),
    )
    op.create_index(op.f('ix_role_permissions_permission_id'), 'role_permissions', ['permission_id'])

    # =====================
    # users
    # =====================
    op.create_table(
        'users',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('username', sa.String(64), unique=True, nullable=False),
        sa.Column('email', sa.String(256), unique=True, nullable=False),
        sa.Column('hashed_password', sa.String(256), nullable=False),
        sa.Column('full_name', sa.String(128), nullable=False),
        sa.Column('phone', sa.String(32)),
        sa.Column('id_card_encrypted', sa.String(512)),
        sa.Column('is_active', sa.Boolean, default=True),
        sa.Column('role', sa.String(64), default='操作员'),
        sa.Column('unit_id', sa.String(36), sa.ForeignKey('units.id', ondelete='SET NULL')),
        sa.Column('created_at', sa.DateTime, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime, server_default=sa.func.now(), onupdate=sa.func.now()),
    )
    op.create_index(op.f('ix_users_username'), 'users', ['username'], unique=True)
    op.create_index(op.f('ix_users_email'), 'users', ['email'], unique=True)
    op.create_index(op.f('ix_users_unit_id'), 'users', ['unit_id'])

    # =====================
    # cadres
    # =====================
    op.create_table(
        'cadres',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('name', sa.String(64), nullable=False),
        sa.Column('id_card_encrypted', sa.String(512)),
        sa.Column('gender', sa.String(8)),
        sa.Column('birth_date', sa.String(32)),
        sa.Column('ethnicity', sa.String(32)),
        sa.Column('native_place', sa.String(128)),
        sa.Column('political_status', sa.String(32)),
        sa.Column('education', sa.String(32)),
        sa.Column('degree', sa.String(32)),
        sa.Column('unit_id', sa.String(36), sa.ForeignKey('units.id', ondelete='SET NULL'), index=True),
        sa.Column('position', sa.String(128)),
        sa.Column('rank', sa.String(32)),
        sa.Column('category', sa.String(100)),
        sa.Column('tags', sa.JSON, default=dict),
        sa.Column('profile', sa.Text),
        sa.Column('resume', sa.Text),
        sa.Column('achievements', sa.JSON, default=list),
        sa.Column('is_available', sa.Boolean, default=True),
        sa.Column('is_active', sa.Boolean, default=True),
        sa.Column('created_at', sa.DateTime, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime, server_default=sa.func.now(), onupdate=sa.func.now()),
    )
    op.create_index(op.f('ix_cadres_unit_id'), 'cadres', ['unit_id'])

    # =====================
    # knowledge
    # =====================
    op.create_table(
        'knowledge',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('title', sa.String(256), nullable=False),
        sa.Column('category', sa.String(32), nullable=False, index=True),
        sa.Column('content', sa.Text),
        sa.Column('version', sa.String(16), default='1.0'),
        sa.Column('version_history', sa.JSON, default=list),
        sa.Column('tags', sa.JSON, default=list),
        sa.Column('source', sa.String(256)),
        sa.Column('effective_date', sa.DateTime),
        sa.Column('is_published', sa.Boolean, default=False),
        sa.Column('is_active', sa.Boolean, default=True),
        sa.Column('attachments', sa.JSON),
        sa.Column('created_by', sa.String(36), nullable=False),
        sa.Column('created_at', sa.DateTime, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime, server_default=sa.func.now(), onupdate=sa.func.now()),
    )
    op.create_index(op.f('ix_knowledge_category'), 'knowledge', ['category'])

    # =====================
    # plans
    # =====================
    op.create_table(
        'plans',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('name', sa.String(256), nullable=False),
        sa.Column('round_name', sa.String(64)),
        sa.Column('year', sa.Integer, nullable=False),
        sa.Column('status', sa.String(32), default='draft', index=True),
        sa.Column('planned_start_date', sa.DateTime),
        sa.Column('planned_end_date', sa.DateTime),
        sa.Column('actual_start_date', sa.DateTime),
        sa.Column('actual_end_date', sa.DateTime),
        sa.Column('scope', sa.Text),
        sa.Column('focus_areas', sa.JSON, default=list),
        sa.Column('target_units', sa.JSON, default=list),
        sa.Column('round_number', sa.Integer),
        sa.Column('version', sa.Integer, default=1),
        sa.Column('version_history', sa.JSON, default=list),
        sa.Column('authorization_letter', sa.Text),
        sa.Column('authorization_date', sa.DateTime),
        sa.Column('approval_comment', sa.Text),
        sa.Column('approved_by', sa.String(36)),
        sa.Column('is_active', sa.Boolean, default=True),
        sa.Column('created_by', sa.String(36), nullable=False),
        sa.Column('created_at', sa.DateTime, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime, server_default=sa.func.now(), onupdate=sa.func.now()),
    )
    op.create_index(op.f('ix_plans_status'), 'plans', ['status'])

    # =====================
    # plan_versions
    # =====================
    op.create_table(
        'plan_versions',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('plan_id', sa.String(36), sa.ForeignKey('plans.id', ondelete='CASCADE'), nullable=False),
        sa.Column('version', sa.Integer, nullable=False),
        sa.Column('data', sa.JSON, nullable=False),
        sa.Column('created_by', sa.String(36), nullable=False),
        sa.Column('created_at', sa.DateTime, server_default=sa.func.now()),
    )
    op.create_index(op.f('ix_plan_versions_plan_id'), 'plan_versions', ['plan_id'])

    # =====================
    # inspection_groups
    # =====================
    op.create_table(
        'inspection_groups',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('name', sa.String(128), nullable=False),
        sa.Column('plan_id', sa.String(36), sa.ForeignKey('plans.id', ondelete='CASCADE'), nullable=False),
        sa.Column('status', sa.String(32), default='draft'),
        sa.Column('target_unit_id', sa.String(36), sa.ForeignKey('units.id', ondelete='SET NULL')),
        sa.Column('authorization_letter', sa.Text),
        sa.Column('authorization_date', sa.DateTime),
        sa.Column('is_active', sa.Boolean, default=True),
        sa.Column('created_by', sa.String(36), nullable=False),
        sa.Column('created_at', sa.DateTime, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime, server_default=sa.func.now(), onupdate=sa.func.now()),
        sa.Column('unit_ids', sa.JSON, default=list),
    )
    op.create_index(op.f('ix_inspection_groups_plan_id'), 'inspection_groups', ['plan_id'])
    op.create_index(op.f('ix_inspection_groups_target_unit_id'), 'inspection_groups', ['target_unit_id'])

    # =====================
    # group_members
    # =====================
    op.create_table(
        'group_members',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('group_id', sa.String(36), sa.ForeignKey('inspection_groups.id', ondelete='CASCADE'), nullable=False),
        sa.Column('cadre_id', sa.String(36), sa.ForeignKey('cadres.id', ondelete='CASCADE'), nullable=False),
        sa.Column('role', sa.String(32)),
        sa.Column('is_leader', sa.Boolean, default=False),
        sa.Column('assigned_at', sa.DateTime, server_default=sa.func.now()),
    )
    op.create_index(op.f('ix_group_members_group_id'), 'group_members', ['group_id'])
    op.create_index(op.f('ix_group_members_cadre_id'), 'group_members', ['cadre_id'])

    # =====================
    # drafts
    # =====================
    op.create_table(
        'drafts',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('title', sa.String(256), nullable=False),
        sa.Column('group_id', sa.String(36), sa.ForeignKey('inspection_groups.id', ondelete='CASCADE')),
        sa.Column('unit_id', sa.String(36), sa.ForeignKey('units.id', ondelete='CASCADE')),
        sa.Column('status', sa.String(32), default='draft', index=True),
        sa.Column('content', sa.Text),
        sa.Column('category', sa.String(32)),
        sa.Column('problem_type', sa.String(64)),
        sa.Column('severity', sa.String(16)),
        sa.Column('evidence_summary', sa.Text),
        sa.Column('preliminary_reviewer', sa.String(36)),
        sa.Column('preliminary_review_comment', sa.Text),
        sa.Column('preliminary_review_at', sa.DateTime),
        sa.Column('final_reviewer', sa.String(36)),
        sa.Column('final_review_comment', sa.Text),
        sa.Column('final_review_at', sa.DateTime),
        sa.Column('approved_by', sa.String(36)),
        sa.Column('approved_at', sa.DateTime),
        sa.Column('is_active', sa.Boolean, default=True),
        sa.Column('created_by', sa.String(36), nullable=False),
        sa.Column('created_at', sa.DateTime, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime, server_default=sa.func.now(), onupdate=sa.func.now()),
    )
    op.create_index(op.f('ix_drafts_status'), 'drafts', ['status'])
    op.create_index(op.f('ix_drafts_group_id'), 'drafts', ['group_id'])
    op.create_index(op.f('ix_drafts_unit_id'), 'drafts', ['unit_id'])

    # =====================
    # draft_attachments
    # =====================
    op.create_table(
        'draft_attachments',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('draft_id', sa.String(36), sa.ForeignKey('drafts.id', ondelete='CASCADE'), nullable=False),
        sa.Column('file_name', sa.String(256), nullable=False),
        sa.Column('file_path', sa.String(512), nullable=False),
        sa.Column('file_size', sa.Integer),
        sa.Column('mime_type', sa.String(128)),
        sa.Column('file_hash', sa.String(64)),
        sa.Column('uploaded_by', sa.String(36), nullable=False),
        sa.Column('created_at', sa.DateTime, server_default=sa.func.now()),
    )
    op.create_index(op.f('ix_draft_attachments_draft_id'), 'draft_attachments', ['draft_id'])

    # =====================
    # clues
    # =====================
    op.create_table(
        'clues',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('title', sa.String(256), nullable=False),
        sa.Column('content', sa.Text, nullable=False),
        sa.Column('source', sa.String(64)),
        sa.Column('source_detail', sa.String(256)),
        sa.Column('category', sa.String(32)),
        sa.Column('severity', sa.String(16)),
        sa.Column('status', sa.String(32), default='registered', index=True),
        sa.Column('transfer_target', sa.String(128)),
        sa.Column('transfer_date', sa.DateTime),
        sa.Column('transfer_comment', sa.Text),
        sa.Column('handling_result', sa.Text),
        sa.Column('is_high_confidential', sa.Boolean, default=False),
        sa.Column('registered_by', sa.String(36), nullable=False),
        sa.Column('created_at', sa.DateTime, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime, server_default=sa.func.now(), onupdate=sa.func.now()),
    )
    op.create_index(op.f('ix_clues_status'), 'clues', ['status'])

    # =====================
    # rectifications
    # =====================
    op.create_table(
        'rectifications',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('title', sa.String(256), nullable=False),
        sa.Column('plan_id', sa.String(36), sa.ForeignKey('plans.id', ondelete='SET NULL')),
        sa.Column('clue_id', sa.String(36), sa.ForeignKey('clues.id', ondelete='SET NULL')),
        sa.Column('draft_id', sa.String(36), sa.ForeignKey('drafts.id', ondelete='SET NULL')),
        sa.Column('unit_id', sa.String(36), sa.ForeignKey('units.id', ondelete='CASCADE')),
        sa.Column('problem_description', sa.Text, nullable=False),
        sa.Column('rectification_requirement', sa.Text),
        sa.Column('deadline', sa.DateTime),
        sa.Column('status', sa.String(32), default='dispatched', index=True),
        sa.Column('progress', sa.Integer, default=0),
        sa.Column('progress_details', sa.JSON, default=list),
        sa.Column('sign_date', sa.DateTime),
        sa.Column('sign_by', sa.String(36)),
        sa.Column('completion_date', sa.DateTime),
        sa.Column('completion_report', sa.Text),
        sa.Column('verification_comment', sa.Text),
        sa.Column('verified_by', sa.String(36)),
        sa.Column('verified_at', sa.DateTime),
        sa.Column('alert_level', sa.String(16), default='green'),
        sa.Column('alert_triggered_at', sa.DateTime),
        sa.Column('confirmed_completed', sa.Boolean),
        sa.Column('confirm_notes', sa.Text),
        sa.Column('confirmed_at', sa.DateTime),
        sa.Column('confirmed_by', sa.String(36)),
        sa.Column('is_active', sa.Boolean, default=True),
        sa.Column('created_by', sa.String(36), nullable=False),
        sa.Column('created_at', sa.DateTime, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime, server_default=sa.func.now(), onupdate=sa.func.now()),
    )
    op.create_index(op.f('ix_rectifications_status'), 'rectifications', ['status'])
    op.create_index(op.f('ix_rectifications_plan_id'), 'rectifications', ['plan_id'])
    op.create_index(op.f('ix_rectifications_clue_id'), 'rectifications', ['clue_id'])
    op.create_index(op.f('ix_rectifications_draft_id'), 'rectifications', ['draft_id'])
    op.create_index(op.f('ix_rectifications_unit_id'), 'rectifications', ['unit_id'])

    # =====================
    # alerts
    # =====================
    op.create_table(
        'alerts',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('type', sa.String(32), nullable=False),
        sa.Column('title', sa.String(256), nullable=False),
        sa.Column('content', sa.Text),
        sa.Column('entity_type', sa.String(32)),
        sa.Column('entity_id', sa.String(36)),
        sa.Column('level', sa.String(16), default='warning'),
        sa.Column('is_resolved', sa.Boolean, default=False, index=True),
        sa.Column('resolved_by', sa.String(36)),
        sa.Column('resolved_at', sa.DateTime),
        sa.Column('created_at', sa.DateTime, server_default=sa.func.now()),
    )
    op.create_index(op.f('ix_alerts_is_resolved'), 'alerts', ['is_resolved'])

    # =====================
    # attachments
    # =====================
    op.create_table(
        'attachments',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('entity_type', sa.String(32), nullable=False),
        sa.Column('entity_id', sa.String(36)),
        sa.Column('file_name', sa.String(256), nullable=False),
        sa.Column('file_path', sa.String(512), nullable=False),
        sa.Column('file_size', sa.Integer, nullable=False),
        sa.Column('mime_type', sa.String(128), nullable=False),
        sa.Column('file_hash', sa.String(64)),
        sa.Column('version', sa.Integer, default=1),
        sa.Column('uploaded_by', sa.String(36), nullable=False),
        sa.Column('created_at', sa.DateTime, server_default=sa.func.now()),
    )

    # =====================
    # audit_logs
    # =====================
    op.create_table(
        'audit_logs',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('user_id', sa.String(36), sa.ForeignKey('users.id', ondelete='SET NULL')),
        sa.Column('action', sa.String(64), nullable=False),
        sa.Column('entity_type', sa.String(32), nullable=False),
        sa.Column('entity_id', sa.String(36)),
        sa.Column('detail', sa.JSON, default=dict),
        sa.Column('ip_address', sa.String(45)),
        sa.Column('user_agent', sa.String(256)),
        sa.Column('created_at', sa.DateTime, server_default=sa.func.now()),
    )
    op.create_index(op.f('ix_audit_logs_user_id'), 'audit_logs', ['user_id'])

    # =====================
    # module_configs
    # =====================
    op.create_table(
        'module_configs',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('module_code', sa.String(64), unique=True, nullable=False),
        sa.Column('module_name', sa.String(128), nullable=False),
        sa.Column('is_enabled', sa.Boolean, default=True),
        sa.Column('config', sa.JSON, default=dict),
        sa.Column('created_at', sa.DateTime, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime, server_default=sa.func.now(), onupdate=sa.func.now()),
    )
    op.create_index(op.f('ix_module_configs_module_code'), 'module_configs', ['module_code'], unique=True)

    # =====================
    # rule_configs
    # =====================
    op.create_table(
        'rule_configs',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('rule_code', sa.String(64), unique=True, nullable=False),
        sa.Column('rule_name', sa.String(128), nullable=False),
        sa.Column('rule_type', sa.String(32), nullable=False),
        sa.Column('params', sa.JSON, default=dict),
        sa.Column('is_active', sa.Boolean, default=True),
        sa.Column('priority', sa.Integer, default=0),
        sa.Column('created_at', sa.DateTime, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime, server_default=sa.func.now(), onupdate=sa.func.now()),
    )
    op.create_index(op.f('ix_rule_configs_rule_code'), 'rule_configs', ['rule_code'], unique=True)

    # =====================
    # notifications
    # =====================
    op.create_table(
        'notifications',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('user_id', sa.String(36), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('type', sa.String(32), nullable=False),
        sa.Column('title', sa.String(256), nullable=False),
        sa.Column('content', sa.String(2048), nullable=False),
        sa.Column('link', sa.String(512)),
        sa.Column('is_read', sa.Boolean, default=False, index=True),
        sa.Column('created_at', sa.DateTime, server_default=sa.func.now()),
    )
    op.create_index(op.f('ix_notifications_user_id'), 'notifications', ['user_id'])
    op.create_index(op.f('ix_notifications_is_read'), 'notifications', ['is_read'])

    # =====================
    # system_configs
    # =====================
    op.create_table(
        'system_configs',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('key', sa.String(100), unique=True, nullable=False),
        sa.Column('value', sa.Text, nullable=False),
        sa.Column('description', sa.String(500)),
        sa.Column('created_at', sa.DateTime, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime, server_default=sa.func.now(), onupdate=sa.func.now()),
    )
    op.create_index(op.f('ix_system_configs_key'), 'system_configs', ['key'], unique=True)

    # =====================
    # field_options
    # =====================
    op.create_table(
        'field_options',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('field_key', sa.String(100), unique=True, nullable=False),
        sa.Column('label', sa.String(200), nullable=False),
        sa.Column('options', sa.Text, nullable=False),
        sa.Column('sort_order', sa.Integer, default=0),
        sa.Column('created_at', sa.DateTime, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime, server_default=sa.func.now(), onupdate=sa.func.now()),
    )
    op.create_index(op.f('ix_field_options_field_key'), 'field_options', ['field_key'], unique=True)

    # =====================
    # progress
    # =====================
    op.create_table(
        'progress',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('plan_id', sa.String(36), sa.ForeignKey('plans.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('group_id', sa.String(36), sa.ForeignKey('inspection_groups.id', ondelete='CASCADE'), index=True),
        sa.Column('week_number', sa.Integer, nullable=False),
        sa.Column('report_date', sa.DateTime, nullable=False),
        sa.Column('talk_count', sa.Integer, default=0),
        sa.Column('doc_review_count', sa.Integer, default=0),
        sa.Column('petition_count', sa.Integer, default=0),
        sa.Column('visit_count', sa.Integer, default=0),
        sa.Column('problem_total', sa.Integer, default=0),
        sa.Column('problem_party', sa.Integer, default=0),
        sa.Column('problem_pty', sa.Integer, default=0),
        sa.Column('problem_key', sa.Integer, default=0),
        sa.Column('next_week_plan', sa.Text),
        sa.Column('notes', sa.Text),
        sa.Column('is_active', sa.Boolean, default=True),
        sa.Column('created_by', sa.String(36), nullable=False),
        sa.Column('created_at', sa.DateTime, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime, server_default=sa.func.now(), onupdate=sa.func.now()),
    )
    op.create_index(op.f('ix_progress_plan_id'), 'progress', ['plan_id'])
    op.create_index(op.f('ix_progress_group_id'), 'progress', ['group_id'])

    # =====================
    # documents
    # =====================
    op.create_table(
        'documents',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('title', sa.String(256), nullable=False),
        sa.Column('doc_number', sa.String(64)),
        sa.Column('type', sa.String(32), nullable=False, index=True),
        sa.Column('generate_date', sa.DateTime, nullable=False),
        sa.Column('generator', sa.String(36)),
        sa.Column('file_path', sa.String(512)),
        sa.Column('file_url', sa.String(512)),
        sa.Column('plan_id', sa.String(36), sa.ForeignKey('plans.id', ondelete='SET NULL'), index=True),
        sa.Column('rectification_id', sa.String(36), sa.ForeignKey('rectifications.id', ondelete='SET NULL'), index=True),
        sa.Column('is_active', sa.Boolean, default=True),
        sa.Column('created_at', sa.DateTime, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime, server_default=sa.func.now(), onupdate=sa.func.now()),
    )
    op.create_index(op.f('ix_documents_type'), 'documents', ['type'])
    op.create_index(op.f('ix_documents_plan_id'), 'documents', ['plan_id'])
    op.create_index(op.f('ix_documents_rectification_id'), 'documents', ['rectification_id'])


def downgrade() -> None:
    op.drop_table('documents')
    op.drop_table('progress')
    op.drop_table('field_options')
    op.drop_table('system_configs')
    op.drop_table('notifications')
    op.drop_table('rule_configs')
    op.drop_table('module_configs')
    op.drop_table('audit_logs')
    op.drop_table('attachments')
    op.drop_table('alerts')
    op.drop_table('rectifications')
    op.drop_table('clues')
    op.drop_table('draft_attachments')
    op.drop_table('drafts')
    op.drop_table('group_members')
    op.drop_table('inspection_groups')
    op.drop_table('plan_versions')
    op.drop_table('plans')
    op.drop_table('knowledge')
    op.drop_table('cadres')
    op.drop_table('users')
    op.drop_table('user_roles')
    op.drop_table('role_permissions')
    op.drop_table('permissions')
    op.drop_table('roles')
    op.drop_table('units')
