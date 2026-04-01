/** Display-only game category; used in forms and cards. */
export const GAME_TYPES = [
  { value: 'general', label: '通用' },
  { value: 'deck-building', label: '卡牌构建' },
  { value: 'worker-placement', label: '工人放置' },
  { value: 'cooperative', label: '合作类' },
  { value: 'area-control', label: '区域控制' },
  { value: 'engine-building', label: '引擎构建' },
  { value: 'dungeon-crawler', label: '地牢爬行' },
] as const

export const GAME_TYPE_LABEL: Record<string, string> = Object.fromEntries(
  GAME_TYPES.map((t) => [t.value, t.label]),
)
