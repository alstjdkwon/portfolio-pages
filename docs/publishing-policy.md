# 포트폴리오 게시 운영 정책

이 저장소만이 PDF 원본, 변환 페이지, 공개 경로를 관리합니다. 별도 가입, 업로드 API,
관리자 웹 화면, 회사별 통계 기능은 제공하지 않습니다.

## Microsoft Clarity

공개 열람 페이지의 기본 방문, 스크롤, 체류 시간 히트맵은 Microsoft Clarity가 수집합니다.
실제 GitHub Pages 빌드 환경에는 `CLARITY_PROJECT_ID`를 Clarity 프로젝트 ID로 명시해야 합니다.
값이 없으면 로컬 빌드는 정상적으로 완료되며 Clarity 스크립트를 포함하지 않습니다. 임의의
대체 ID나 페이지별·회사별 맞춤 분석은 생성하지 않습니다.

`portfolio/manifest.json`은 공개 가능한 버전과 경로의 단일 목록입니다. 새 PDF는 새 버전
ID, `docs/` 또는 `assets/versions/` 아래의 원본 파일 경로, 전체 페이지 목록, 해당 커밋의
40자리 SHA를 기록해야 합니다. 기존 버전과 경로는 수정하거나 삭제할 수 없으며, 새 회사
링크는 기존 버전 ID를 재사용할 수 있습니다.

게시 워크플로는 먼저 `Authorize portfolio publishing`을 호출해야 합니다. 이 검사는
`PORTFOLIO_OWNER_LOGIN` 저장소 변수가 현재 Actions 실행자와 일치하는지 확인합니다. 따라서
저장소 기본 브랜치는 소유자만 변경할 수 있도록 보호하고, 이 변수에는 소유자의 GitHub 로그인
이름을 설정해야 합니다.

초기 검증은 매니페스트에 고정한 SHA-256과 일치하는 PDF만 처리합니다. 초기 PC 검증 상태가
`passed`이고 `repeatingPublishEnabled`가 `true`가 되기 전에는 반복 PDF 게시가 실패합니다.
검증을 통과한 뒤 새 매니페스트는 다음 명령으로 이전 공개 자료의 불변성을 검사해야 합니다.

```sh
node scripts/validate-manifest.mjs --previous previous-manifest.json
```

## Actions 상태와 Pages 배포

`.github/workflows/publish-pages.yml`은 초기 검증용 `bootstrap`과 검증 통과 후의
`repeat` 실행을 같은 GitHub Actions 흐름으로 처리합니다. 초기 검증은 **Run workflow**에서
`bootstrap`과 고정 PDF의 저장소 경로를 입력하여 시작합니다. 기본 브랜치의 이후 변경은
`repeat` 처리로 시작하며, 초기 검증 통과 전이면 승인 단계에서 실패합니다.

실행 중에는 Actions 요약에 `processing`이 표시되며 새 공유 링크는 제공되지 않습니다.
워크플로는 Poppler로 새 버전의 원본 PDF를 작업공간에 변환합니다. 매니페스트에 선언된
렌더링 페이지 디렉터리가 이미 있으면 그 자산을 덮어쓰지 않고 검증합니다. 페이지 디렉터리가
없으면 전체 변환 결과의 순서·경로·치수를 매니페스트와 대조합니다. 이어서 원본 PDF·전체
변환 이미지·매니페스트를 검증하고, 완전한 정적 사이트 산출물을 만든 뒤에만 GitHub Pages
배포 작업을 시작합니다. 생성한 페이지는 성공한 Pages 산출물에만 포함되며, 원본 저장소의
기존 버전 자산을 변경하지 않습니다. 성공한 배포 작업의 `published` 요약에만 공유할 Pages
URL이 표시됩니다.

검증, 산출물 생성 또는 배포 중 하나라도 실패하면 `failed` 요약이 표시되고 새 링크는
출력되지 않습니다. 실패한 실행은 Pages 배포 작업을 실행하지 않으므로 기존 GitHub Pages
게시본이 계속 공개됩니다.
