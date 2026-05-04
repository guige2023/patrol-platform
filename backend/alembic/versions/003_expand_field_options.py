"""
扩展 field_options 表：支持所有非时间/非数值字段的配置管理
- 新增: entity_type, column_name, data_type, is_editable, is_required, is_visible, is_picklist
- 现有记录: 解析 field_key 填充 entity_type/column_name，设置合理的默认值
"""

from alembic import op
import sqlalchemy as sa

# revision identifiers
revision = '003_expand_field_options'
down_revision = '002_add_rectification_rejection'
branch_labels = None
depends_on = None


# 现有 field_key → (entity_type, column_name, data_type)
LEGACY_MAPPING = {
    'unit_type':           ('units',             'type',               'select'),
    'unit_level':          ('units',             'level',              'select'),
    'cadre_category':      ('cadres',            'category',           'select'),
    'cadre_rank':          ('cadres',            'rank',               'select'),
    'knowledge_category':  ('knowledge',          'category',           'select'),
    'api_test':           ('test',               'api_test',           'text'),
    'api_test_field':     ('test',               'api_test_field',     'select'),
    'test_field_api':     ('test',               'test_field_api',     'select'),
}


def upgrade() -> None:
    # 1. 添加新列（全部 nullable，以便后续填充）
    op.add_column('field_options', sa.Column('entity_type', sa.String(64), nullable=True))
    op.add_column('field_options', sa.Column('column_name', sa.String(64), nullable=True))
    op.add_column('field_options', sa.Column('data_type', sa.String(32), nullable=True,
                       server_default='text'))
    op.add_column('field_options', sa.Column('is_editable', sa.Boolean, nullable=True,
                       server_default='true'))
    op.add_column('field_options', sa.Column('is_required', sa.Boolean, nullable=True,
                       server_default='false'))
    op.add_column('field_options', sa.Column('is_visible', sa.Boolean, nullable=True,
                       server_default='true'))
    op.add_column('field_options', sa.Column('is_picklist', sa.Boolean, nullable=True,
                       server_default='false'))

    # 2. 为现有记录填充 entity_type / column_name / data_type
    for field_key, (entity_type, column_name, data_type) in LEGACY_MAPPING.items():
        op.execute(sa.text("""
            UPDATE field_options
            SET entity_type   = :et,
                column_name    = :cn,
                data_type     = :dt,
                is_picklist   = TRUE,
                is_editable   = TRUE,
                is_required   = FALSE,
                is_visible    = TRUE
            WHERE field_key = :fk
        """).bindparams(et=entity_type, cn=column_name, dt=data_type, fk=field_key))

    # 3. 为剩余（未知）记录填充默认值
    op.execute(sa.text("""
        UPDATE field_options
        SET entity_type  = 'unknown',
            column_name = field_key,
            data_type  = 'text',
            is_picklist = (options IS NOT NULL AND options != '' AND options != '[]'),
            is_editable = TRUE,
            is_required = FALSE,
            is_visible  = TRUE
        WHERE entity_type IS NULL
    """))

    # 4. 加 NOT NULL 约束
    op.alter_column('field_options', 'entity_type', nullable=False)
    op.alter_column('field_options', 'column_name', nullable=False)
    op.alter_column('field_options', 'data_type', nullable=False, server_default='text')
    op.alter_column('field_options', 'is_editable', nullable=False, server_default='true')
    op.alter_column('field_options', 'is_required', nullable=False, server_default='false')
    op.alter_column('field_options', 'is_visible', nullable=False, server_default='true')
    op.alter_column('field_options', 'is_picklist', nullable=False, server_default='false')

    # 5. 加索引（加速按 entity_type 查询）
    op.create_index('ix_field_options_entity_type', 'field_options', ['entity_type'])


def downgrade() -> None:
    op.drop_index('ix_field_options_entity_type', 'field_options')
    op.drop_column('field_options', 'is_picklist')
    op.drop_column('field_options', 'is_visible')
    op.drop_column('field_options', 'is_required')
    op.drop_column('field_options', 'is_editable')
    op.drop_column('field_options', 'data_type')
    op.drop_column('field_options', 'column_name')
    op.drop_column('field_options', 'entity_type')
