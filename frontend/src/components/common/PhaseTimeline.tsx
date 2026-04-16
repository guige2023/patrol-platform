import React from 'react';
import { Steps } from 'antd';

export type InspectionPhase = 
  | 'draft'                    // 制定计划
  | 'plan_approved'            // 计划批准
  | 'forming_group'            // 组建巡察组
  | 'group_ready'              // 巡察组就绪
  | 'announcement'             // 发布公告
  | 'deployment_meeting'       // 召开部署会
  | 'inspection_active'        // 巡察进行中
  | 'report_writing'           // 撰写报告
  | 'report_finalized'         // 报告定稿
  | 'feedback'                 // 反馈意见
  | 'rectification'            // 整改中
  | 'rectification_complete'   // 整改完成
  | 'review'                   // 回头看
  | 'archived';                // 归档

const PHASE_ORDER: InspectionPhase[] = [
  'draft',
  'plan_approved',
  'forming_group',
  'group_ready',
  'announcement',
  'deployment_meeting',
  'inspection_active',
  'report_writing',
  'report_finalized',
  'feedback',
  'rectification',
  'rectification_complete',
  'review',
  'archived',
];

const PHASE_LABELS: Record<InspectionPhase, string> = {
  draft: '制定计划',
  plan_approved: '计划批准',
  forming_group: '组建巡察组',
  group_ready: '巡察组就绪',
  announcement: '发布公告',
  deployment_meeting: '召开部署会',
  inspection_active: '巡察进行中',
  report_writing: '撰写报告',
  report_finalized: '报告定稿',
  feedback: '反馈意见',
  rectification: '整改中',
  rectification_complete: '整改完成',
  review: '回头看',
  archived: '归档',
};

interface PhaseTimelineProps {
  currentPhase: InspectionPhase;
  onPhaseClick?: (phase: InspectionPhase) => void;
}

const PhaseTimeline: React.FC<PhaseTimelineProps> = ({ currentPhase, onPhaseClick }) => {
  const currentIndex = PHASE_ORDER.indexOf(currentPhase);

  const getStatus = (index: number): 'wait' | 'process' | 'finish' | 'error' => {
    if (index < currentIndex) return 'finish';
    if (index === currentIndex) return 'process';
    return 'wait';
  };

  return (
    <div style={{ padding: '16px 0' }}>
      <Steps
        current={currentIndex}
        size="small"
        items={PHASE_ORDER.map((phase, index) => ({
          title: PHASE_LABELS[phase],
          status: getStatus(index),
          onClick: () => onPhaseClick?.(phase),
        }))}
      />
    </div>
  );
};

export default PhaseTimeline;
