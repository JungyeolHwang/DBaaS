# Kubernetes로 Mini DBaaS 구축하기: DBA의 클라우드 네이티브 엔지니어링 도전기

## 왜 만들게 되었나요?

데이터베이스 관리자(DBA)로서 항상 AWS RDS 같은 클라우드 데이터베이스 서비스가 내부적으로 어떻게 동작하는지 궁금했습니다. 단순히 이런 서비스의 소비자가 되는 것이 아니라, Database-as-a-Service(DBaaS) 플랫폼을 구축하는 엔지니어링 도전과제를 이해하고 싶었습니다.

특히 **AWS Aurora MySQL의 빠른 스냅샷 생성 및 클러스터 복원 기능**에 매료되어, 이런 고급 기능들을 직접 구현해보고 싶었습니다. 또한 다양한 데이터베이스(PostgreSQL, MySQL, MariaDB)를 지원하면서 고가용성과 자동 페일오버 기능까지 갖춘 완전한 DBaaS 플랫폼을 만들어보고 싶었습니다.

### 💡 **개발 동기와 목표**
- **Node.js 학습**: 백엔드 개발 역량 강화를 위한 실전 프로젝트
- **Kubernetes 이해**: DBA로서 클라우드 네이티브 기술 습득
- **AWS Aurora 스타일 기능 구현**: 빠른 스냅샷과 클러스터 복원
- **고가용성 시스템 구축**: 자동 페일오버가 포함된 HA 클러스터
- **스케일링 기능 구현**: 동적 리소스 할당 및 수평/수직 확장
- **복원 기능 구현**: AWS Aurora 스타일의 빠른 복원 및 크로스 인스턴스 복원
- **다중 데이터베이스 지원**: PostgreSQL, MySQL, MariaDB 통합 관리

### 💡 **개발 도구 투자**
처음에는 개발 실력이 부족했기 때문에 **Cursor IDE**를 약 40달러 투자하여 구매했습니다. 이 도구는 AI 기반 코드 생성과 자동완성 기능을 제공하여, 복잡한 Kubernetes 매니페스트와 Node.js 백엔드 코드 작성에 큰 도움이 되었습니다. 특히 Helm 차트 템플릿과 Kubernetes Operator 설정 같은 복잡한 YAML 파일들을 효율적으로 작성할 수 있었습니다.

목표는 간단했습니다: **Node.js와 Kubernetes를 사용해서 1주일 만에 완전히 동작하는 DBaaS를 구축**하여 클라우드 네이티브 기술에 대한 실무 경험을 쌓고 분산 시스템에 대한 이해를 깊이하는 것이었습니다.

## 도전 과제

DBaaS를 구축하는 것은 제가 마스터해야 할 여러 복잡한 컴포넌트가 포함되어 있습니다:

- **데이터베이스 배포 자동화** (여러 데이터베이스 타입 지원)
- **멀티 테넌트 격리** (적절한 리소스 관리)
- **백업 및 복구 시스템** (포인트 인 타임 복구)
- **고가용성 클러스터링** (자동 장애 복구)
- **실시간 모니터링** 및 헬스 체크
- **AWS Aurora 스타일 스냅샷 시스템** (빠른 백업/복원)

## 마주친 주요 문제들

### 1. Kubernetes StatefulSet의 복잡성
Kubernetes에서 상태 유지 데이터베이스를 관리하는 것은 예상보다 까다로웠습니다. 다음을 배워야 했습니다:
- 데이터 지속성을 위한 Persistent Volume Claims (PVC)
- 백업/복구를 위한 CSI VolumeSnapshots
- 적절한 리소스 할당 및 제한
- 멀티 테넌시를 위한 네임스페이스 격리

**해결책**: 각 데이터베이스 타입별로 적절한 StatefulSet 구성이 포함된 커스텀 Helm 차트를 생성했습니다.

### 2. 다중 데이터베이스 지원과 고가용성 구현
각 데이터베이스(PostgreSQL, MySQL, MariaDB)는 서로 다른 배포 패턴을 가집니다:
- **PostgreSQL**: HA 클러스터를 위한 Zalando PostgreSQL Operator (✅ 성공)
- **MySQL/MariaDB**: 모니터링 익스포터가 포함된 커스텀 StatefulSet (❌ HA 구현 실패)
- 서로 다른 설정 요구사항과 연결 패턴

**해결책**: 데이터베이스별 차이점을 추상화하면서 각 데이터베이스 타입의 장점을 활용하는 통합 API를 구축했습니다. PostgreSQL의 경우 Zalando Operator를 성공적으로 통합했지만, MySQL HA 클러스터 구현은 복잡성으로 인해 단일 인스턴스로 제한했습니다.

### 3. AWS Aurora 스타일 백업 및 복구 시스템
Aurora의 빠른 스냅샷 생성과 클러스터 복원 기능을 구현하는 것이 핵심 목표였습니다:
- 스토리지 레벨 백업을 위한 CSI VolumeSnapshots
- 크로스 인스턴스 백업 복원
- 백업 검증 및 테스트
- **5-10초 내 스냅샷 생성** (Aurora 수준의 성능 목표)

**해결책**: 모든 데이터베이스 타입에서 작동하는 빠른 스토리지 레벨 백업을 위해 hostpath-driver가 포함된 CSI VolumeSnapshots를 사용했습니다. 빈 데이터베이스 기준으로 Aurora와 유사한 수준의 빠른 백업 성능(5-10초)을 달성할 수 있었습니다.

### 4. 고가용성 클러스터링 (PostgreSQL vs MySQL)
자동 장애 복구가 포함된 HA 클러스터 설정에서 흥미로운 차이점을 발견했습니다:

**PostgreSQL HA (✅ 성공)**:
- Zalando PostgreSQL Operator 통합
- Master/Replica 서비스 분리
- 자동 장애 감지 및 복구

**MySQL HA (❌ 실패)**:
- Percona XtraDB Cluster 복잡성
- Group Replication 설정의 어려움
- Operator 패턴의 한계

**해결책**: PostgreSQL의 경우 자동 장애 복구가 포함된 프로덕션급 HA 클러스터를 위해 Zalando PostgreSQL Operator를 성공적으로 통합했습니다. MySQL은 현재 단일 인스턴스로 제한하고, 향후 MySQL Operator나 Percona Operator를 통한 HA 구현을 계획하고 있습니다.

## 무엇을 만들었나요

1주일의 개발 후, 다음과 같은 동작하는 DBaaS 플랫폼을 갖게 되었습니다:

### ✅ **완성된 기능들**
- **다중 데이터베이스 지원**: PostgreSQL, MySQL, MariaDB 인스턴스
- **고가용성**: 자동 장애 복구가 포함된 PostgreSQL HA 클러스터
- **AWS Aurora 스타일 백업/복구**: CSI VolumeSnapshot 기반 빠른 스냅샷 (5-10초)
- **RESTful API**: 인스턴스 관리를 위한 완전한 CRUD 작업
- **실시간 모니터링**: Pod 상태, 리소스 사용량, 헬스 체크
- **멀티 테넌트 격리**: 네임스페이스 기반 리소스 격리
- **리소스 스케일링**: 동적 CPU/메모리 할당

### 🚧 **현재 한계점들**
- **웹 UI 없음**: 현재 CLI/API만 지원 (Phase 1에서 계획)
- **MySQL HA**: PostgreSQL HA 클러스터만 지원 (MySQL HA 구현 실패로 인한 제한)
- **모니터링**: 기본 모니터링만 (Prometheus/Grafana 계획)
- **보안**: 기본 인증만 (JWT/RBAC 계획)
- **멀티 테넌시**: 기본 네임스페이스 격리만 (고급 기능 계획)

### 📊 **성능 지표**
- **백업 생성**: 5-10초 (Aurora 수준, 빈 데이터베이스 기준)
- **데이터베이스 복원**: 30초 내 (빈 데이터베이스 기준)
- **인스턴스 배포**: 몇 초 내
- **HA 페일오버**: 자동 감지 및 복구

> 💡 **참고**: 백업/복원 시간은 빈 데이터베이스 기준입니다. 실제 운영 환경에서는 데이터 크기에 따라 시간이 달라질 수 있습니다.

## 기술적 아키텍처

```
사용자 요청 → Node.js API → Kubernetes → 데이터베이스 인스턴스
                ↓
        CSI VolumeSnapshots (Aurora 스타일 백업/복구)
                ↓
    PostgreSQL HA 클러스터 (Zalando Operator)
                ↓
        실시간 모니터링 및 헬스 체크
```

### 기술 스택
- **백엔드**: Node.js + Express
- **오케스트레이션**: Kubernetes + Helm
- **데이터베이스**: PostgreSQL, MySQL, MariaDB
- **고가용성**: Zalando PostgreSQL Operator
- **백업/복구**: CSI VolumeSnapshots (Aurora 스타일)
- **모니터링**: 실시간 pod/helm 상태 추적
- **개발 도구**: Cursor IDE (AI 기반 코드 생성)

## 주요 학습 내용

### 1. Kubernetes 심화 학습
- **StatefulSet**은 데이터베이스 워크로드에 강력하지만 복잡함
- **CSI VolumeSnapshots**은 Aurora 수준의 백업 기능 제공
- **네임스페이스 격리**는 멀티 테넌트 환경에 중요
- **리소스 할당량**은 리소스 고갈을 방지

### 2. Kubernetes에서의 데이터베이스 운영
- **Helm 차트**는 데이터베이스 배포를 훨씬 쉽게 만듦
- **Operator**는 프로덕션급 데이터베이스 관리 제공
- **헬스 체크**는 안정적인 데이터베이스 운영에 필수
- **ConfigMap을 통한 설정 관리**는 우아함

### 3. 클라우드 네이티브 패턴
- **API 우선 설계**는 자동화와 통합을 가능하게 함
- **이벤트 기반 아키텍처**는 확장성 향상
- **Helm 차트를 통한 Infrastructure as Code**
- **구조화된 로깅과 메트릭을 통한 관찰성**

### 4. 개발 도구의 중요성
- **Cursor IDE**의 AI 기반 코드 생성이 복잡한 Kubernetes 매니페스트 작성에 큰 도움
- **AI 도구 활용**이 개발 생산성과 학습 속도를 크게 향상시킴
- **적절한 도구 투자**가 프로젝트 성공에 중요한 역할

## 결과

제 미니 DBaaS는 이제 다음을 할 수 있습니다:
- PostgreSQL, MySQL, MariaDB 인스턴스를 몇 초 만에 배포
- 자동 장애 복구가 포함된 고가용성 PostgreSQL 클러스터 제공
- **5-10초 내에 Aurora 스타일 백업 생성** (목표 달성!, 빈 데이터베이스 기준)
- 30초 내에 데이터베이스 복원 (빈 데이터베이스 기준)
- 리소스를 동적으로 스케일링
- 실시간으로 헬스와 성능 모니터링

## 다음 단계

이 경험을 바탕으로 향후 개선을 위한 포괄적인 로드맵을 만들었습니다:

### Phase 1 (1-2주)
- 시각적 관리를 위한 React 웹 UI
- **MySQL HA 클러스터 재도전** (Percona XtraDB Operator 또는 MySQL Operator)
- Prometheus + Grafana 모니터링 스택

### Phase 2 (3-4주)
- 자동화된 백업 스케줄링
- JWT 기반 인증 및 RBAC
- 성능 모니터링 대시보드

### Phase 3 (5-8주)
- 고급 멀티 테넌트 기능
- 보안 강화 (암호화, 감사 로그)
- 클라우드 프로바이더 통합

## 왜 이것이 중요한가

이 프로젝트는 클라우드 서비스를 구축하는 것이 단순히 기술에 관한 것이 아니라, 대규모로 데이터베이스를 관리할 때 발생하는 운영상의 도전과제를 이해하는 것에 관한 것임을 가르쳐주었습니다. DBA로서 이 경험은 다음과 같은 것을 제공했습니다:

- **클라우드 네이티브 아키텍처에 대한 깊은 이해**
- **Kubernetes와 컨테이너화에 대한 실무 경험**
- **클라우드 프로바이더가 데이터베이스 도전과제를 해결하는 방법에 대한 통찰**
- **복잡한 분산 시스템을 다루는 자신감**
- **AI 도구를 활용한 현대적 개발 방법론 경험**

## 확인해보세요

전체 소스코드는 GitHub에서 확인할 수 있습니다:
**https://github.com/JungyeolHwang/DBaaS**

### 빠른 시작
```bash
# 저장소 클론
git clone https://github.com/JungyeolHwang/DBaaS.git
cd DBaaS

# 설정 스크립트 실행
./scripts/setup.sh

# API 서버 시작
cd backend && npm start

# 첫 번째 데이터베이스 생성
curl -X POST http://localhost:3000/instances \
  -H "Content-Type: application/json" \
  -d '{
    "type": "postgresql",
    "name": "my-first-db",
    "config": {
      "password": "securepass123",
      "storage": "2Gi"
    }
  }'
```

## 결론

이 미니 DBaaS를 구축하는 것은 놀라운 학습 경험이었습니다. 올바른 도구와 이해를 가지고 있다면 사이드 프로젝트로도 프로덕션 준비가 된 데이터베이스 서비스를 구축할 수 있다는 것을 보여주었습니다.

특히 **Cursor IDE**라는 AI 도구에 투자한 것이 프로젝트 성공에 큰 역할을 했습니다. 복잡한 Kubernetes 매니페스트와 Node.js 백엔드 코드를 효율적으로 작성할 수 있었고, 이는 개발 초기 단계에서 큰 도움이 되었습니다.

**AWS Aurora 스타일의 빠른 스냅샷 기능**을 구현하는 것이 핵심 목표였는데, CSI VolumeSnapshots를 통해 빈 데이터베이스 기준으로 5-10초 내 백업 생성이라는 목표를 달성할 수 있었습니다. 실제 운영 환경에서는 데이터 크기에 따라 백업 시간이 달라질 수 있지만, 스토리지 레벨 스냅샷을 사용하여 Aurora와 유사한 빠른 백업 성능을 구현할 수 있었습니다.

**고가용성 시스템 구축**에서는 PostgreSQL의 경우 Zalando Operator를 성공적으로 통합하여 자동 페일오버가 포함된 HA 클러스터를 구현할 수 있었습니다. 다만 MySQL HA 클러스터 구현은 예상보다 복잡하여 현재는 PostgreSQL만 지원하고 있지만, 이는 향후 개선 계획에 포함되어 있습니다.

**스케일링 기능**과 **빠른 복원 기능**도 중요한 목표였는데, Kubernetes의 동적 리소스 할당을 통해 스케일링을 구현했고, CSI VolumeSnapshots를 활용하여 AWS Aurora와 유사한 빠른 복원 성능을 달성할 수 있었습니다.

단순한 데이터베이스 관리에서 클라우드 네이티브 엔지니어링으로의 여정은 눈을 뜨게 하는 경험이었습니다. Kubernetes, Helm, 현대적인 DevOps 관행들이 제가 데이터베이스 운영에 대해 생각하는 방식을 완전히 바꿨습니다.

클라우드 네이티브 엔지니어링으로 스킬을 확장하고 싶은 DBA라면, 비슷한 것을 구축해보는 것을 강력히 추천합니다. 작게 시작하고, 핵심 기능에 집중하고, 점진적으로 복잡성을 추가하세요. 그리고 필요하다면 적절한 개발 도구에 투자하는 것도 고려해보세요!

**당신의 다음 클라우드 네이티브 프로젝트는 무엇이 될까요?**

---

## 태그
#kubernetes #database #dba #cloud-native #nodejs #postgresql #mysql #mariadb #side-project #engineering #devops #cursor-ide #aws-aurora #ha-clustering

---

*이 프로젝트는 클라우드 네이티브 데이터베이스 서비스를 이해하기 위한 학습 연습으로 구축되었습니다. 기여, 포크, 또는 자신의 프로젝트에 영감으로 사용하세요!* 