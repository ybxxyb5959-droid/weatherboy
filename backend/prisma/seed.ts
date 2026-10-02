// 개발용 Seed: 관리자 계정 하나를 만든다 (GUEST 계정, 로그인은 /api/auth/guest 세션이 필요하므로
// 실제 운영 관리자는 Kakao 로그인 후 DB 에서 isAdmin 을 직접 true 로 변경한다).
// 사용법: npm run prisma:seed
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const email = process.env.SEED_ADMIN_KAKAO_ID
  if (!email) {
    console.log('SEED_ADMIN_KAKAO_ID 가 없어 관리자 지정을 건너뜁니다. (Kakao 로그인 후 아래 SQL 로 지정 가능)')
    console.log(`UPDATE "User" SET "isAdmin" = true WHERE id = (SELECT "userId" FROM "AuthIdentity" WHERE provider='KAKAO' AND "providerUserId"='<카카오 id>');`)
    return
  }
  const identity = await prisma.authIdentity.findUnique({ where: { provider_providerUserId: { provider: 'KAKAO', providerUserId: email } } })
  if (!identity) {
    console.log('해당 Kakao 계정이 아직 로그인한 적이 없어요. 먼저 로그인한 뒤 다시 실행하세요.')
    return
  }
  await prisma.user.update({ where: { id: identity.userId }, data: { isAdmin: true } })
  console.log('관리자로 지정했어요.')
}

main().finally(() => prisma.$disconnect())
