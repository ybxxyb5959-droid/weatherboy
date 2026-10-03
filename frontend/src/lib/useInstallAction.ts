import { useState } from 'react'
import { detectPlatform, openInExternalBrowser, useInstall } from './install'

// 설치가 바로 안 될 때 보여 줄 안내
export const helpText = {
  kakao: '카카오톡 안에서는 설치할 수 없어요. 오른쪽 아래 ⋮(또는 공유) 버튼을 눌러 "다른 브라우저로 열기"를 한 뒤 다시 눌러주세요.',
  ios: '아이폰은 사파리에서 하단의 공유 버튼(네모에 화살표)을 누르고 "홈 화면에 추가"를 눌러주세요.',
  android: '크롬 오른쪽 위 ⋮ 메뉴에서 "홈 화면에 추가"(또는 "앱 설치")를 눌러주세요.',
  other: '크롬이나 엣지 주소창 오른쪽의 설치 아이콘을 누르거나, 메뉴에서 "앱 설치"를 눌러주세요.',
}

/** "앱으로 설치하고 테스트해주기" 버튼의 동작. 바로 설치할 수 있으면 설치 창을, 아니면 환경에 맞는 안내를 띄운다. */
export function useInstallAction() {
  const { canPrompt, installed, prompt } = useInstall()
  const [hint, setHint] = useState('')
  const [helpOpen, setHelpOpen] = useState(false)

  const install = async () => {
    setHint('')
    const platform = detectPlatform()
    if (platform === 'kakao') {
      setHint(helpText.kakao)
      openInExternalBrowser()
      return
    }
    if (canPrompt) {
      const ok = await prompt()
      if (!ok) setHint('설치를 취소했어요. 필요하면 다시 눌러주세요.')
      return
    }
    // 바로 설치 창을 띄울 수 없는 환경(아이폰, 이미 설치됨 등): 방법을 안내한다
    setHint(helpText[platform])
    setHelpOpen(true)
  }

  return { install, installed, hint, helpOpen, setHelpOpen }
}
