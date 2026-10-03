/** 분위기 이름 뒤에 '느낌'을 붙인다. 이름이 이미 '…느낌'으로 끝나면(예: 포멀한 정장 느낌) 겹치지 않게 그대로 쓴다. */
export const feel = (label: string) => (label.endsWith('느낌') ? label : `${label} 느낌`)
