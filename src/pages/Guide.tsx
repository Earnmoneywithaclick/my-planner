import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Card, PageHeader, SectionTitle } from '../components/ui'
import { ChevronLeft } from '../components/icons'

const APP_URL = 'https://earnmoneywithaclick.github.io/my-planner/'

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card>
      <SectionTitle>{title}</SectionTitle>
      <div className="text-[16px] leading-relaxed text-ink-2 space-y-2 [&_b]:text-ink [&_b]:font-semibold">{children}</div>
    </Card>
  )
}

const Bullets = ({ items }: { items: ReactNode[] }) => (
  <ul className="space-y-1.5 list-disc pl-5 marker:text-ink-3">
    {items.map((it, i) => (
      <li key={i}>{it}</li>
    ))}
  </ul>
)

const Steps = ({ items }: { items: ReactNode[] }) => (
  <ol className="space-y-1.5 list-decimal pl-5 marker:text-ink-3">
    {items.map((it, i) => (
      <li key={i}>{it}</li>
    ))}
  </ol>
)

/** 앱 사용 안내 (설정 > 사용 안내). 친구에게 보낸 안내 문서와 같은 내용 */
export default function Guide() {
  return (
    <>
      <PageHeader
        title="사용 안내"
        right={
          <Link to="/settings" className="h-11 px-2 flex items-center text-accent font-semibold text-[16px]">
            <ChevronLeft width={22} height={22} /> 설정
          </Link>
        }
      />
      <div className="gutter board">
        <Section title="이 앱은">
          <p>계획, 시간표, 할 일, 생각해 볼 질문을 한곳에서 관리하는 앱이에요.</p>
          <Bullets
            items={[
              '기록은 계정마다 따로 저장돼서 서로 보이지 않아요.',
              '같은 이메일로 로그인한 아이폰과 아이패드는 기록이 자동으로 맞춰져요.',
              '인터넷이 없어도 쓸 수 있고, 연결되면 알아서 동기화돼요.',
            ]}
          />
        </Section>

        <Section title="설치와 등록">
          <p>등록된 이메일만 로그인할 수 있어요.</p>
          <Steps
            items={[
              <>
                아이폰 <b>Safari</b>로{' '}
                <a href={APP_URL} className="text-accent underline break-all">
                  {APP_URL}
                </a>{' '}
                를 열어요.
              </>,
              <>
                아래쪽 <b>공유 버튼</b>을 눌러요.
              </>,
              <>
                <b>홈 화면에 추가</b> → <b>추가</b>를 눌러요.
              </>,
              <>
                홈 화면의 <b>플래너</b> 아이콘으로 열어요.
              </>,
              <>
                이메일을 입력하고 <b>인증 코드 받기</b> → 메일로 온 코드를 넣고 <b>로그인</b>.
              </>,
            ]}
          />
          <p>아이패드도 같은 방법으로 추가하고 같은 이메일로 로그인하면 돼요.</p>
        </Section>

        <Section title="오늘 화면">
          <Bullets
            items={[
              <>
                <b>일용할 성구</b>: <b>성구 열기</b>로 그날 성구를 열고, 읽으면 <b>읽음</b>(체크 표시로 바뀌고, 다시 누르면 취소). 연속으로 읽은 날 수와 이번 달 읽은 날이 표시돼요.
              </>,
              <>
                <b>기도 · 개인 연구</b>: 했으면 눌러서 체크. <b>+ 묵상 메모</b>에 적용할 점을 적어요. 성구 카드 오른쪽 위 메모 버튼을 누르면 지금까지 적은 메모를 모아 보고 검색할 수 있어요.
              </>,
              <>
                <b>성경 읽기</b> (jw.org 연구용 성경 기준): 처음에 <b>읽기 계획 세우기</b>로 범위(성경 전체 · 히브리어-아람어 성경 · 그리스도인 그리스어 성경 · 직접 고르기)와 시작일을 정하고, <b>기간으로</b>(90일 · 1년 등) 또는 <b>하루 분량으로</b>(하루 n장) 정해요. 매일 <b>오늘 읽을 곳</b>이 나오고, <b>읽기</b>를 누르면 JW Library 앱에서 그 장이 바로 열리고(앱이 없으면 jw.org 웹 성경) 다 읽으면 <b>다 읽음</b>(다시 누르면 되돌리기). 진행률과 계획보다 앞섰는지 밀렸는지도 보여요. 카드 위쪽을 누르면 <b>어디까지 읽었나요?</b>에서 위치를 고치거나 계획을 수정·삭제해요.
              </>,
              <>
                <b>봉사</b>:<b>+15분 · +30분 · +1시간</b>으로 오늘 시간을 더하고, 잘못 누르면 <b>−15분</b>. 카드를 누르면 달별 총 시간과 날짜별 기록(월말 결산)이 나와요.
              </>,
              <>
                <b>오늘 일정</b>: 오늘 일정과 반복 일정이 시간순으로 나와요. + 버튼으로 바로 추가할 때는 달력 없이 오늘 · 내일 · 모레 중에서 골라요. 더 먼 날이나 며칠짜리 일정은 시간표 탭에서 추가해요.
              </>,
              <>
                <b>오늘 할 일</b>: 적고 + 버튼. 동그라미를 누르면 완료.
              </>,
              <>
                <b>오늘의 질문</b>: 생각을 적고 <b>답 저장</b>. 다른 걸 보려면 <b>다른 질문</b>.
              </>,
            ]}
          />
        </Section>

        <Section title="시간표">
          <Bullets
            items={[
              '하루짜리 일정은 색 점, 며칠짜리 일정은 이어진 막대로 보여요.',
              '날짜를 한 번 누르면 그날 일정, 빠르게 두 번 누르면 바로 일정 추가.',
              '좌우로 밀거나 ‹ › 로 달을 넘겨요.',
              '일정 추가 창의 작은 달력에서 마지막 날을 누르면 며칠짜리 일정이 돼요.',
              <>
                <b>매주 반복</b> 탭: 요일마다 반복되는 일정. 어느 요일에서 열어도 한 번에 고치고 지워져요.
              </>,
            ]}
          />
        </Section>

        <Section title="할 일">
          <Bullets
            items={[
              '오른쪽 위 + 버튼: 할 일 하나 추가 (마감일, 중요도, 묶음, 메모).',
              '목록 모양 버튼: 묶음 이름과 할 일을 한 줄에 하나씩 적어 한 번에 추가.',
              '묶음 카드의 + 버튼으로 더 넣고, ⋯ 버튼으로 이름·기간·상태·카테고리를 고치거나 삭제.',
              '카드 제목을 누르면 접히고 펴져요.',
              <>
                <b>완료</b> 필터에 끝낸 할 일과 이루거나 멈춘 묶음이 모여요.
              </>,
              '삭제는 확인 없이 바로 되니 조심하세요.',
            ]}
          />
        </Section>

        <Section title="질문과 설정">
          <Bullets
            items={[
              <>
                질문을 눌러 답을 적고, <b>내일 · 1주 뒤 · 1달 뒤 다시</b>로 다시 볼 날을 정해요.
              </>,
              <>
                <b>설정 &gt; 카테고리</b>: 이름을 바꾸고, 색 동그라미를 눌러 색을 바꿔요.
              </>,
              <>
                <b>설정 &gt; 백업</b>: <b>내보내기</b>로 백업 파일을 '파일' 앱이나 iCloud Drive에 저장해 두면 안심이에요.
              </>,
            ]}
          />
        </Section>

        <Section title="자주 묻는 것">
          <Bullets
            items={[
              <>
                <b>인증 메일이 안 와요</b> → 스팸함을 확인하고, <b>이메일 다시 입력</b>으로 다시 받아요.
              </>,
              <>
                <b>새 기능이 안 보여요</b> → 앱을 완전히 닫았다가 다시 열어요. 그래도 그대로면 한 번 더.
              </>,
              <>
                <b>아이패드에 기록이 안 나와요</b> → 같은 이메일인지 확인하고 설정에서 <b>지금 동기화</b>.
              </>,
              <>
                <b>주소창이 보여요</b> → Safari로 연 거예요. 홈 화면 아이콘으로 열어요.
              </>,
            ]}
          />
        </Section>
      </div>
    </>
  )
}
