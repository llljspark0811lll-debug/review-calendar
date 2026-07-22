// 관리자 알림용 텔레그램 발송. 이메일 인증번호(sendEmailVerificationCode)와
// 달리 이 알림은 순수 부가 기능이라, 실패해도 절대 원래 요청(회원가입/체험단
// 등록 등)을 막으면 안 된다 - 그래서 내부에서 에러를 전부 삼키고 절대 throw하지
// 않는다. 서버리스 환경에서 응답 전송 후 promise가 끊길 수 있으므로 호출하는
// 쪽에서는 반드시 await해서 완료를 기다려야 한다.
export async function sendTelegramMessage(text: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    console.info(`[telegram] ${text}`);
    return;
  }

  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text }),
    });

    if (!response.ok) {
      console.error("[telegram] send failed", await response.text());
    }
  } catch (error) {
    console.error("[telegram] send failed", error);
  }
}
