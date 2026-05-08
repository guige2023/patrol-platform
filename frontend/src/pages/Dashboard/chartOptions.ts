export const STATUS_COLORS: Record<string, string> = {
  drafted: '#8c8c8c',
  dispatched: '#1677ff',
  signed: '#722ed1',
  progressing: '#faad14',
  completed: '#52c41a',
  submitted: '#13c2c2',
  verified: '#003eb3',
  rejected: '#ff4d4f',
}

export const STATUS_LABELS: Record<string, string> = {
  drafted: '草稿',
  dispatched: '已派发',
  signed: '已签收',
  progressing: '整改中',
  completed: '已完成',
  submitted: '待验收',
  verified: '已验收',
  rejected: '已驳回',
}

export const ALERT_COLORS: Record<string, string> = {
  green: '#52c41a',
  yellow: '#faad14',
  orange: '#fa8c16',
  red: '#ff4d4f',
}

export function getProgressColor(percentage: number): string {
  if (percentage >= 100) return '#52c41a'
  if (percentage >= 70) return '#1677ff'
  if (percentage >= 30) return '#faad14'
  return '#ff4d4f'
}

// 整改状态环形图
export function buildDonutOption(rectByStatus: { status: string; count: number }[]) {
  return {
    tooltip: { trigger: 'item' as const },
    legend: {
      orient: 'vertical' as const,
      right: 10,
      top: 'middle',
      itemWidth: 10,
      itemHeight: 10,
      textStyle: { fontSize: 11 },
    },
    series: [{
      type: 'pie',
      radius: ['45%', '70%'],
      center: ['35%', '50%'],
      avoidLabelOverlap: true,
      itemStyle: { borderRadius: 4, borderColor: '#fff', borderWidth: 2 },
      label: { show: false },
      emphasis: {
        label: { show: true, fontSize: 12, fontWeight: 'bold' },
      },
      data: rectByStatus.map((r) => ({
        name: STATUS_LABELS[r.status] || r.status,
        value: r.count,
        itemStyle: { color: STATUS_COLORS[r.status] || '#d9d9d9' },
      })),
    }],
  }
}

// 预警级别分布柱状图
export function buildAlertBarOption(rectByLevel: { level: string; count: number }[]) {
  return {
    tooltip: { trigger: 'axis' as const },
    grid: { left: 50, right: 20, top: 10, bottom: 30 },
    xAxis: {
      type: 'category' as const,
      data: rectByLevel.map((r) =>
        r.level === 'green' ? '绿色' : r.level === 'yellow' ? '黄色' : r.level === 'orange' ? '橙色' : r.level === 'red' ? '红色' : r.level,
      ),
      axisLabel: { fontSize: 11 },
    },
    yAxis: { type: 'value' as const, axisLabel: { fontSize: 10 } },
    series: [{
      type: 'bar' as const,
      data: rectByLevel.map((r) => ({
        value: r.count,
        itemStyle: {
          color: ALERT_COLORS[r.level] || '#d9d9d9',
          borderRadius: [4, 4, 0, 0],
        },
      })),
      barMaxWidth: 40,
    }],
  }
}

// 整改甘特图
export function buildGanttOption(deadlines: { title: string; deadline: string }[]) {
  return {
    tooltip: {
      trigger: 'axis' as const,
      axisPointer: { type: 'shadow' as const },
      formatter: (params: any) => {
        const d = params[0]
        return `${d.name}<br/>截止: ${d.value}天`
      },
    },
    grid: { left: 120, right: 30, top: 10, bottom: 30 },
    xAxis: {
      type: 'value' as const,
      name: '剩余天数',
      axisLabel: { fontSize: 10 },
      max: (val: any) => Math.max(val.max, 1),
    },
    yAxis: {
      type: 'category' as const,
      data: deadlines.slice(0, 6).map((d) =>
        d.title.length > 12 ? d.title.substring(0, 12) + '...' : d.title,
      ),
      axisLabel: { fontSize: 11 },
    },
    series: [{
      type: 'bar' as const,
      data: deadlines.slice(0, 6).map((d) => {
        const days = Math.max(0, Math.ceil((new Date(d.deadline).getTime() - Date.now()) / 86400000))
        const color = days <= 3 ? '#ff4d4f' : days <= 7 ? '#fa8c16' : days <= 14 ? '#faad14' : '#52c41a'
        return { value: days, itemStyle: { color, borderRadius: [0, 4, 4, 0] } }
      }),
      barMaxWidth: 20,
      label: { show: true, position: 'right', fontSize: 10, formatter: (p: any) => `${p.value}天` },
    }],
  }
}

// 整改趋势折线图
export function buildTrendOption(rectificationTrend: { month: string; completed: number; submitted: number; rejected: number }[]) {
  return {
    tooltip: { trigger: 'axis' as const },
    legend: {
      data: ['已完成', '已提交', '已驳回'],
      bottom: 0,
    },
    grid: { left: 40, right: 20, top: 10, bottom: 50 },
    xAxis: {
      type: 'category' as const,
      data: rectificationTrend.map((t) => t.month),
      axisLabel: { fontSize: 11 },
    },
    yAxis: { type: 'value' as const, minInterval: 1, axisLabel: { fontSize: 11 } },
    series: [
      {
        name: '已完成',
        type: 'line',
        itemStyle: { color: '#52c41a' },
        data: rectificationTrend.map((t) => t.completed),
        smooth: true,
      },
      {
        name: '已提交',
        type: 'line',
        itemStyle: { color: '#1677ff' },
        data: rectificationTrend.map((t) => t.submitted),
        smooth: true,
      },
      {
        name: '已驳回',
        type: 'line',
        itemStyle: { color: '#ff4d4f' },
        data: rectificationTrend.map((t) => t.rejected),
        smooth: true,
      },
    ],
  }
}

// 年度工作量柱状图
export function buildYearlyBarOption(yearlyStats: { plan_counts: number[]; group_counts: number[] } | null) {
  return {
    tooltip: { trigger: 'axis' },
    legend: {
      data: ['巡察计划', '巡察组'],
      bottom: 0,
    },
    grid: { left: 40, right: 20, top: 20, bottom: 50 },
    xAxis: {
      type: 'category',
      data: ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'],
      axisLabel: { fontSize: 11 },
    },
    yAxis: { type: 'value', minInterval: 1, axisLabel: { fontSize: 11 } },
    series: [
      {
        name: '巡察计划',
        type: 'bar',
        itemStyle: { color: '#C80000', borderRadius: [4, 4, 0, 0] },
        barMaxWidth: 36,
        data: yearlyStats?.plan_counts || Array(12).fill(0),
      },
      {
        name: '巡察组',
        type: 'bar',
        itemStyle: { color: '#1677FF', borderRadius: [4, 4, 0, 0] },
        barMaxWidth: 36,
        data: yearlyStats?.group_counts || Array(12).fill(0),
      },
    ],
  }
}
