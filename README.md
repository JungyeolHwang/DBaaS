# Mini DBaaS (Database as a Service)

Node.js + Kubernetes 기반의 로컬 데이터베이스 서비스 플랫폼

![Status](https://img.shields.io/badge/Status-Working%20✅-brightgreen)
![Node.js](https://img.shields.io/badge/Node.js-v24.1.0-green)
![Kubernetes](https://img.shields.io/badge/Kubernetes-minikube-blue)
![Helm](https://img.shields.io/badge/Helm-v3.18.4-blue)
![Docker](https://img.shields.io/badge/Docker-Required-blue)

> 🎉 **2025-01-27 업데이트**: Zalando PostgreSQL Operator 기반 HA 클러스터로 전환 완료! 컨트롤러 리팩토링으로 코드 구조 개선

## 🏗️ 아키텍처 개요

```
사용자 요청 (CLI / UI)
         ↓
Node.js API 서버 (Express)
- DB 인스턴스 생성/삭제/조회 API
- YAML 템플릿 생성
- kubectl/Helm으로 배포 명령
         ↓
Kubernetes (minikube)
- Namespace per user/project
- StatefulSet + PVC (DB Pod)
- Secret, ConfigMap
         ↓
Local Storage (PVC, HostPath)
- MySQL/MariaDB/PostgreSQL 데이터 저장
         ↓
🔄 Aurora 스타일 백업/복구 시스템
CSI VolumeSnapshot (DB 무관)
- 무중단 스냅샷 생성 (5-10초)
- 빠른 복구 (30-60초)
- PostgreSQL/MySQL/MariaDB 공통 지원
         ↓
🐘 PostgreSQL HA 클러스터 (Zalando Operator 기반)
Zalando PostgreSQL Operator
- 자동 Failover (장애 감지 시)
- Primary + Standby (3개 노드)
- 읽기 부하 분산 (Master/Replica 서비스)
- 무중단 고가용성 서비스
         ↓
Prometheus + Grafana
- CPU, Memory, Query 성능 지표
- PostgreSQL / MySQL Exporter
```

## 🚀 빠른 시작

### 1. 자동 환경 설정 (권장)
```bash
# 전체 환경을 자동으로 설정
./scripts/setup.sh
```

### 2. 수동 환경 설정
```bash
# Docker Desktop 시작 (필수)
# minikube 시작
minikube start

# Helm 레포지토리 추가
helm repo add bitnami https://charts.bitnami.com/bitnami
helm repo update

# 백엔드 의존성 설치 및 환경 설정
cd backend
npm install
cp env.example .env
```

### 3. 백엔드 서버 실행
```bash
cd backend
npm start
```

### 4. API 사용 예시

#### 4.1 헬스체크
```bash
curl http://localhost:3000/health
```

#### 4.2 PostgreSQL 인스턴스 생성
```bash
curl -X POST http://localhost:3000/instances \
  -H "Content-Type: application/json" \
  -d '{
    "type": "postgresql", 
    "name": "my-postgres", 
    "config": {
      "password": "securepass123",
      "storage": "2Gi",
      "database": "myapp"
    }
  }'
```

#### 4.3 MySQL 인스턴스 생성
```bash
curl -X POST http://localhost:3000/instances \
  -H "Content-Type: application/json" \
  -d '{
    "type": "mysql", 
    "name": "my-mysql",
    "config": {
      "password": "mysqlpass123",
      "storage": "1Gi"
    }
  }'
```

#### 4.4 인스턴스 관리
```bash
# 모든 인스턴스 목록 조회
curl http://localhost:3000/instances

# 특정 인스턴스 상태 확인
curl http://localhost:3000/instances/my-postgres

# 연결 정보 조회
curl http://localhost:3000/instances/my-postgres/connection

# 인스턴스 삭제
curl -X DELETE http://localhost:3000/instances/my-postgres
```

### 5. 테스트 스크립트 실행
```bash
# 자동화된 API 테스트
./scripts/test-api.sh
```

## ✅ 현재 상태 (2025-01-27)

### 🔥 완료된 기능
- ✅ **완전한 프로젝트 구조**: 사용자 규칙에 따른 체계적 디렉토리 구성
- ✅ **Node.js API 서버**: Express 기반 RESTful API 서버 (포트 3000)
- ✅ **Kubernetes 통합**: minikube 클러스터와 완전 연동
- ✅ **Helm 차트 자동 배포**: PostgreSQL, MySQL, MariaDB 지원
- ✅ **실시간 상태 모니터링**: Pod, 네임스페이스, Helm 릴리스 상태 추적
- ✅ **네임스페이스 격리**: 각 DB 인스턴스별 독립된 환경
- ✅ **자동화 스크립트**: 환경 설정 및 API 테스트 스크립트
- ✅ **CSI 백업/복구 시스템**: Aurora 스타일 무중단 백업 및 빠른 복구
- ✅ **PostgreSQL HA 클러스터**: Zalando PostgreSQL Operator 기반 고가용성 클러스터
- ✅ **자동 Failover**: 장애 감지 시 자동 복구
- ✅ **읽기 부하 분산**: Master/Replica 서비스로 성능 최적화
- ✅ **컨트롤러 리팩토링**: 비즈니스 로직과 라우트 분리로 코드 구조 개선

### 🎯 테스트 완료된 시나리오
- ✅ PostgreSQL 인스턴스 생성/조회/삭제
- ✅ Kubernetes Pod 상태 실시간 확인
- ✅ Helm 릴리스 자동 관리
- ✅ 네임스페이스 자동 생성 및 격리
- ✅ API 엔드포인트 전체 동작 확인
- ✅ CSI VolumeSnapshot 백업 생성 (5-10초)
- ✅ 백업에서 새 인스턴스 복구 (30초)
- ✅ 백업 시점 데이터 정확성 검증
- ✅ Zalando PostgreSQL HA 클러스터 생성 및 관리
- ✅ 자동 Failover 테스트 (Primary Pod 삭제 시)
- ✅ 서비스별 연결 테스트 (Master/Replica)

### 🔄 최근 변경사항 (2025-01-27)
- ✅ **CloudNativePG → Zalando Operator 전환**: 더 안정적인 PostgreSQL HA 클러스터
- ✅ **컨트롤러 패턴 도입**: `HAClusterController`로 비즈니스 로직 분리
- ✅ **코드 구조 개선**: 라우트는 URL 매핑만, 컨트롤러는 비즈니스 로직만 담당
- ✅ **유지보수성 향상**: 관심사 분리로 테스트 및 확장 용이

## 🛠️ 기술 스택

- **백엔드**: Node.js (Express)
- **오케스트레이션**: Kubernetes + Helm (Bitnami Charts)
- **데이터베이스**: PostgreSQL, MySQL, MariaDB
- **고가용성**: Zalando PostgreSQL Operator (PostgreSQL HA)
- **백업/복구**: CSI VolumeSnapshot (hostpath-driver)
- **모니터링**: 실시간 Pod/Helm 상태 추적
- **스토리지**: PVC (minikube hostPath)
- **클러스터**: minikube (로컬 개발용)
- **자동화**: Bash 스크립트 (setup.sh, test-api.sh)
- **아키텍처**: MVC 패턴 (Controller-Service 분리)

## 📋 개발 로드맵

- [x] 기본 환경 설정
- [x] Node.js API 서버 구현
- [x] Helm 차트 통합
- [x] 기본 DB 인스턴스 배포 테스트
- [x] CSI 백업/복구 기능
- [x] PostgreSQL HA 클러스터 (Zalando PostgreSQL Operator)
- [x] 자동 Failover 및 부하 분산
- [x] 컨트롤러 리팩토링 (MVC 패턴)
- [ ] MySQL HA 클러스터 (Percona XtraDB Operator)
- [ ] 모니터링 설정 (Prometheus + Grafana)
- [ ] 웹 UI 개발
- [ ] 고급 기능 (Auto Backup, Multi-AZ 등)

## 🎯 지원 기능

### 기본 기능
- DB 인스턴스 생성/삭제/조회
- PostgreSQL HA 클러스터 (Zalando PostgreSQL Operator)
- CSI VolumeSnapshot 백업/복구
- 리소스 모니터링
- 사용자별 네임스페이스 격리
- 인스턴스 복구 (서버 재시작 시)

### 고급 기능 (예정)
- 자동 백업 & 보존 정책
- 버전 업그레이드
- Query 모니터링 대시보드
- Failover & Replica 구성
- DB 사용자 관리
- Audit 로그
- 사용량 기반 과금
- ✅ **멀티 테넌트 지원**: 완전한 테넌트 격리 및 리소스 관리

## �� API 엔드포인트

### 기본 정보
- **Base URL**: `http://localhost:3000`
- **Content-Type**: `application/json`

### 엔드포인트 목록

| 메서드 | 경로 | 설명 | 요청 예시 |
|--------|------|------|-----------|
| `GET` | `/health` | 서버 상태 확인 | - |
| `GET` | `/` | API 정보 | - |
| `GET` | `/instances` | 모든 인스턴스 목록 | - |
| `POST` | `/instances` | 새 인스턴스 생성 | [아래 참조](#인스턴스-생성) |
| `GET` | `/instances/:name` | 특정 인스턴스 상태 | - |
| `GET` | `/instances/:name/connection` | 연결 정보 조회 | - |
| `DELETE` | `/instances/:name` | 인스턴스 삭제 | - |

### HA 클러스터 API (Zalando PostgreSQL 전용)

| 메서드 | 경로 | 설명 | 요청 예시 |
|--------|------|------|-----------|
| `POST` | `/ha-clusters/zalando-postgresql` | Zalando PostgreSQL HA 클러스터 생성 | [아래 참조](#zalando-postgresql-ha-클러스터-생성) |
| `GET` | `/ha-clusters` | 모든 HA 클러스터 목록 | - |
| `GET` | `/ha-clusters/:name/status` | HA 클러스터 상태 조회 | - |
| `DELETE` | `/ha-clusters/:name` | HA 클러스터 삭제 | - |

### 인스턴스 생성

#### PostgreSQL
```json
{
  "type": "postgresql",
  "name": "my-postgres",
  "config": {
    "password": "securepass123",
    "database": "myapp",
    "storage": "2Gi",
    "memory": "512Mi",
    "cpu": "500m"
  }
}
```

#### MySQL
```json
{
  "type": "mysql",
  "name": "my-mysql", 
  "config": {
    "password": "mysqlpass123",
    "storage": "1Gi",
    "memory": "256Mi",
    "cpu": "250m"
  }
}
```

#### MariaDB
```json
{
  "type": "mariadb",
  "name": "my-mariadb",
  "config": {
    "password": "mariapass123", 
    "storage": "1Gi"
  }
}
```

### Zalando PostgreSQL HA 클러스터 생성

#### 기본 HA 클러스터 (3개 노드)
```json
{
  "name": "my-postgres-ha",
  "namespace": "dbaas-postgres-ha",
  "config": {
    "replicas": 3,
    "database": "testdb",
    "username": "admin",
    "password": "postgres123",
    "storage": "1Gi",
    "resources": {
      "requests": {
        "memory": "256Mi",
        "cpu": "250m"
      },
      "limits": {
        "memory": "512Mi", 
        "cpu": "500m"
      }
    }
  }
}
```

#### 고성능 HA 클러스터 (5개 노드)
```json
{
  "name": "prod-postgres-ha",
  "namespace": "dbaas-prod-ha",
  "config": {
    "replicas": 5,
    "database": "production",
    "username": "admin",
    "password": "super-secure-password",
    "storage": "10Gi",
    "maxConnections": 500,
    "sharedBuffers": "256MB",
    "effectiveCacheSize": "1GB",
    "resources": {
      "requests": {
        "memory": "1Gi",
        "cpu": "1000m"
      },
      "limits": {
        "memory": "2Gi",
        "cpu": "2000m"
      }
    }
  }
}
```

### HA 클러스터 사용 예시

#### 1. Zalando PostgreSQL HA 클러스터 생성
```bash
curl -X POST http://localhost:3000/ha-clusters/zalando-postgresql \
  -H "Content-Type: application/json" \
  -d '{
    "name": "api-test-pg-cluster",
    "namespace": "dbaas-api-test-pg-ha",
    "config": {
      "replicas": 3,
      "database": "testdb",
      "username": "admin",
      "password": "postgres123",
      "storage": "1Gi"
    }
  }'
```

#### 2. HA 클러스터 상태 확인
```bash
curl http://localhost:3000/ha-clusters/api-test-pg-cluster/status

# 응답 예시
{
  "success": true,
  "cluster": {
    "name": "api-test-pg-cluster",
    "namespace": "dbaas-api-test-pg-ha",
    "status": "Running",
    "replicas": 3,
    "ready": 3,
    "connections": {
      "master": "api-test-pg-cluster:5432",
      "replica": "api-test-pg-cluster-repl:5432"
    }
  }
}
```

#### 3. 애플리케이션 연결 방법
```javascript
// Node.js 애플리케이션에서 HA 클러스터 사용
const { Pool } = require('pg');

// 쓰기 작업용 (Master)
const writePool = new Pool({
  host: 'api-test-pg-cluster',
  port: 5432,
  user: 'admin',
  password: 'postgres123',
  database: 'testdb'
});

// 읽기 작업용 (Replica)
const readPool = new Pool({
  host: 'api-test-pg-cluster-repl',
  port: 5432,
  user: 'admin', 
  password: 'postgres123',
  database: 'testdb'
});

// 사용 예시
async function createOrder(orderData) {
  // 쓰기는 Master로
  await writePool.query('INSERT INTO orders (data) VALUES ($1)', [orderData]);
}

async function getProducts() {
  // 읽기는 Replica로 (부하 분산)
  const result = await readPool.query('SELECT * FROM products');
  return result.rows;
}
```

## 💾 백업/복구 시스템

### 🚀 Aurora 스타일 CSI 백업

우리의 백업 시스템은 AWS Aurora와 유사한 스토리지 레벨 백업을 제공합니다:

- **무중단 백업**: 실행 중인 DB에서 5-10초 내 스냅샷 생성
- **빠른 복구**: 30초 내 새 인스턴스로 복구
- **DB 독립적**: PostgreSQL, MySQL, MariaDB 모두 지원
- **포인트 인 타임**: 정확한 백업 시점으로 복구

### 📋 백업/복구 API 엔드포인트

| 메서드 | 경로 | 설명 |
|--------|------|------|
| `POST` | `/instances/:name/backup` | 백업 생성 |
| `GET` | `/instances/:name/backups` | 백업 목록 조회 |
| `POST` | `/instances/:name/restore` | 백업에서 복구 |
| `DELETE` | `/instances/:name/backups/:backupName` | 백업 삭제 |

### 🔄 백업 생성 예시

```bash
# PostgreSQL 인스턴스 백업 생성
curl -X POST http://localhost:3000/instances/my-postgres/backup \
  -H "Content-Type: application/json" \
  -d '{
    "backupName": "daily-backup-001",
    "retentionDays": "7"
  }'

# 응답 예시
{
  "success": true,
  "message": "Backup created successfully",
  "backup": {
    "backupName": "daily-backup-001",
    "namespace": "dbaas-my-postgres",
    "pvcName": "data-my-postgres-postgresql-local-0",
    "instanceType": "postgresql",
    "status": "completed",
    "createdAt": "2025-01-27T09:02:15.262Z",
    "size": "2Gi"
  }
}
```

### 🔄 백업에서 복구 예시

```bash
# 백업에서 새 인스턴스로 복구
curl -X POST http://localhost:3000/instances/my-postgres/restore \
  -H "Content-Type: application/json" \
  -d '{
    "backupName": "daily-backup-001",
    "newInstanceName": "recovered-postgres",
    "size": "2Gi"
  }'

# 응답 예시
{
  "success": true,
  "message": "Instance restored from backup successfully",
  "instance": {
    "name": "recovered-postgres",
    "type": "postgresql",
    "status": "restoring",
    "restoredFrom": {
      "sourceInstance": "my-postgres",
      "backupName": "daily-backup-001",
      "restoredAt": "2025-01-27T09:07:02.406Z"
    }
  }
}
```

### 📊 백업 목록 조회

```bash
# 특정 인스턴스의 백업 목록
curl http://localhost:3000/instances/my-postgres/backups

# 응답 예시
{
  "success": true,
  "count": 2,
  "backups": [
    {
      "name": "daily-backup-001",
      "namespace": "dbaas-my-postgres",
      "status": "ready",
      "restoreSize": "2Gi",
      "creationTime": "2025-01-27T09:02:10Z",
      "sourcePVC": "data-my-postgres-postgresql-local-0"
    }
  ]
}
```

### ⚡ 성능 특징

- **백업 속도**: 5-10초 (VolumeSnapshot 생성)
- **복구 속도**: 30초 (PVC + Pod 생성)
- **스토리지 효율**: 증분 백업 지원
- **동시성**: 여러 인스턴스 동시 백업 가능

### 🔧 기술적 구현

```bash
# CSI 드라이버 확인
kubectl get csidriver
# hostpath.csi.k8s.io 드라이버 사용

# VolumeSnapshot 클래스 확인
kubectl get volumesnapshotclass
# csi-hostpath-snapclass 사용

# 생성된 스냅샷 확인
kubectl get volumesnapshots -n dbaas-my-postgres
```

### 📝 백업 전략 권장사항

1. **정기 백업**: 매일 자동 백업 스케줄링
2. **보존 정책**: 7일 단기 + 30일 장기 보존
3. **테스트 복구**: 정기적인 복구 테스트
4. **모니터링**: 백업 성공/실패 알림

## 🏗️ 프로젝트 구조

```
DBaas/
├── 📁 backend/                    # Node.js API 서버
│   ├── 📁 controllers/           # 비즈니스 로직 컨트롤러
│   │   ├── InstanceController.js # 일반 인스턴스 관리
│   │   ├── BackupController.js   # 백업/복구 관리
│   │   └── HAClusterController.js # 🆕 HA 클러스터 관리
│   ├── 📁 routes/                # API 라우트 정의
│   │   ├── instances.js          # 인스턴스 API
│   │   ├── ha-clusters.js        # HA 클러스터 API
│   │   └── backups.js            # 백업 API
│   ├── 📁 services/              # 비즈니스 서비스
│   │   ├── k8s.js               # Kubernetes 연동
│   │   ├── database.js          # 메타데이터 DB
│   │   ├── backup.js            # 백업/복구 서비스
│   │   └── zalandoOperatorService.js # Zalando Operator
│   └── index.js                  # 서버 진입점
├── 📁 helm-charts/               # Helm 차트
│   ├── postgresql-local/         # PostgreSQL 차트
│   ├── mysql-local/              # MySQL 차트
│   └── mariadb-local/            # MariaDB 차트
├── 📁 k8s/                       # Kubernetes 매니페스트
│   └── operators/                # Operator 설정
├── 📁 scripts/                   # 자동화 스크립트
│   ├── setup.sh                  # 환경 설정
│   └── test-api.sh               # API 테스트
└── README.md                     # 프로젝트 문서
```

## 🔧 문제 해결 (Troubleshooting)

### 일반적인 문제

#### 1. kubectl 연결 오류
```bash
# 해결 방법
minikube start
kubectl config current-context  # minikube 확인
```

#### 2. Docker 데몬 오류
```bash
# Docker Desktop 시작 확인
docker ps
```

#### 3. Helm 레포지토리 오류
```bash
# Helm 레포지토리 재설정
helm repo add bitnami https://charts.bitnami.com/bitnami
helm repo update
```

#### 4. 포트 충돌
```bash
# 기존 서버 종료
pkill -f "node.*index.js"
```

#### 5. 백업 생성 실패
```bash
# CSI 드라이버 상태 확인
kubectl get csidriver
minikube addons enable csi-hostpath-driver
minikube addons enable volumesnapshots

# VolumeSnapshot 클래스 확인
kubectl get volumesnapshotclass
```

#### 6. 복구 실패 (크로스 네임스페이스)
```bash
# VolumeSnapshot은 같은 네임스페이스에서만 복구 가능
# 원본과 같은 네임스페이스에서 복구하거나 스냅샷을 복사
kubectl get volumesnapshots -n SOURCE_NAMESPACE
```

#### 7. 인스턴스 정보 없음 (서버 재시작 후)
```bash
# 기존 Helm 릴리스에서 인스턴스 복구
curl -X POST http://localhost:3000/instances/recover \
  -H "Content-Type: application/json" \
  -d '{"name": "INSTANCE_NAME", "namespace": "NAMESPACE"}'
```

#### 8. Zalando Operator 관련 문제
```bash
# Zalando PostgreSQL Operator 설치 확인
kubectl get crd | grep postgresql
kubectl get postgresql --all-namespaces

# Operator 재설치 (필요시)
kubectl apply -f https://raw.githubusercontent.com/zalando/postgres-operator/master/manifests/postgres-operator.yaml
```

### 로그 확인

#### API 서버 로그
백엔드 터미널에서 실시간 로그 확인

#### Kubernetes 로그
```bash
# Pod 로그 확인
kubectl logs -f <pod-name> -n <namespace>

# 예시
kubectl logs -f test-pg-postgresql-0 -n dbaas-test-pg
```

#### Helm 상태 확인
```bash
helm list -A
helm status <release-name> -n <namespace>
```

#### Zalando PostgreSQL 클러스터 로그
```bash
# PostgreSQL 클러스터 상태 확인
kubectl get postgresql -n <namespace>
kubectl describe postgresql <cluster-name> -n <namespace>

# Pod 로그 확인
kubectl logs -f <cluster-name>-0 -n <namespace>
```

## 🚧 알려진 제한사항

1. **로컬 환경 전용**: 현재는 minikube 기반으로 로컬 개발용
2. **단순 인증**: 기본 비밀번호 기반 인증만 지원
3. **PostgreSQL HA만 지원**: MySQL HA는 아직 개발 중
4. **모니터링 제한**: Prometheus/Grafana 연동 예정
5. **UI 없음**: 현재는 CLI/API만 지원
6. **네트워크 제한**: HA 클러스터는 클러스터 내부 접근만 가능
7. **Zalando Operator 제한**: PostgreSQL 15 버전만 지원

## 📞 연락처

개발 문의 및 기여는 언제든 환영합니다! 

## 🏢 멀티 테넌트 지원 (예정)

### 🎯 멀티 테넌트 아키텍처

현재는 기본적인 네임스페이스 격리만 지원하지만, 향후 완전한 멀티 테넌트 시스템을 구현할 예정입니다.

#### 현재 구현된 격리 기능
- ✅ **네임스페이스 격리**: 각 DB 인스턴스별 독립된 환경
- ✅ **사용자별 네임스페이스 격리**: 기본적인 리소스 격리
- ✅ **PVC 격리**: 테넌트별 독립된 스토리지

#### 향후 구현 예정 기능
```yaml
# 테넌트별 리소스 격리 (예정)
tenants:
  tenant-a:
    namespace: "tenant-a"
    resourceQuota:
      cpu: "4"
      memory: "8Gi"
      storage: "100Gi"
    networkPolicy:
      ingress: ["tenant-a-apps"]
      egress: ["internet"]
    billing:
      plan: "premium"
      limits:
        instances: 10
        storage: "500Gi"
```

### 📋 테넌트 격리 레벨

#### 1. 네트워크 격리
- **NetworkPolicy**: 테넌트 간 네트워크 통신 제한
- **Ingress/Egress 규칙**: 허용된 서비스만 접근 가능
- **Service Mesh**: Istio 기반 고급 라우팅

#### 2. 리소스 격리
- **ResourceQuota**: CPU, Memory, Storage 할당량 관리
- **LimitRange**: Pod별 리소스 제한 설정
- **PriorityClass**: 테넌트별 우선순위 관리

#### 3. 데이터 격리
- **네임스페이스 격리**: 완전한 Kubernetes 리소스 분리
- **PVC 격리**: 테넌트별 독립된 스토리지 볼륨
- **Secret 격리**: 테넌트별 독립된 인증 정보

### 📈 확장성 및 성능

#### 수평 확장
- **다중 클러스터**: 테넌트별 클러스터 분산
- **지역 분산**: 글로벌 테넌트 서비스
- **자동 스케일링**: 테넌트별 자동 리소스 조정

#### 성능 최적화
- **캐싱 전략**: 테넌트별 독립된 캐시
- **부하 분산**: 테넌트별 트래픽 분산
- **리소스 예약**: 프리미엄 테넌트용 리소스 예약

--- 