# Mini DBaaS (Database as a Service)

Node.js + Kubernetes 기반의 로컬 데이터베이스 서비스 플랫폼

![Status](https://img.shields.io/badge/Status-Working%20✅-brightgreen)
![Node.js](https://img.shields.io/badge/Node.js-v24.1.0-green)
![Kubernetes](https://img.shields.io/badge/Kubernetes-minikube-blue)
![Helm](https://img.shields.io/badge/Helm-v3.18.4-blue)
![Docker](https://img.shields.io/badge/Docker-Required-blue)

> 🎉 **2025-07-19 업데이트**: CSI 백업/복구 시스템 완성! Aurora 스타일 무중단 백업 및 빠른 복구 지원

## 🏗️ 아키텍처 개요

```
사용자 요청 (CLI / UI)
         ↓
Node.js API 서버 (Fastify / Express)
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
🐘 PostgreSQL HA 클러스터 (Operator 기반)
CloudNativePG Operator
- 자동 Failover (15초 내)
- Primary + 2 Standby (3개 노드)
- 읽기 부하 분산 (RW/RO/R 서비스)
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

## ✅ 현재 상태 (2025-07-19)

### 🔥 완료된 기능
- ✅ **완전한 프로젝트 구조**: 사용자 규칙에 따른 체계적 디렉토리 구성
- ✅ **Node.js API 서버**: Express 기반 RESTful API 서버 (포트 3000)
- ✅ **Kubernetes 통합**: minikube 클러스터와 완전 연동
- ✅ **Helm 차트 자동 배포**: PostgreSQL, MySQL, MariaDB 지원
- ✅ **실시간 상태 모니터링**: Pod, 네임스페이스, Helm 릴리스 상태 추적
- ✅ **네임스페이스 격리**: 각 DB 인스턴스별 독립된 환경
- ✅ **자동화 스크립트**: 환경 설정 및 API 테스트 스크립트
- ✅ **CSI 백업/복구 시스템**: Aurora 스타일 무중단 백업 및 빠른 복구
- ✅ **PostgreSQL HA 클러스터**: CloudNativePG Operator 기반 고가용성 클러스터
- ✅ **자동 Failover**: 15초 내 장애 감지 및 자동 복구
- ✅ **읽기 부하 분산**: RW/RO/R/Any 서비스로 성능 최적화

### 🎯 테스트 완료된 시나리오
- ✅ PostgreSQL 인스턴스 생성/조회/삭제
- ✅ Kubernetes Pod 상태 실시간 확인
- ✅ Helm 릴리스 자동 관리
- ✅ 네임스페이스 자동 생성 및 격리
- ✅ API 엔드포인트 전체 동작 확인
- ✅ CSI VolumeSnapshot 백업 생성 (5-10초)
- ✅ 백업에서 새 인스턴스 복구 (30초)
- ✅ 백업 시점 데이터 정확성 검증
- ✅ PostgreSQL HA 클러스터 생성 및 관리
- ✅ 자동 Failover 테스트 (Primary Pod 삭제 시)
- ✅ 서비스별 연결 테스트 (RW/RO/R/Any)


## 🛠️ 기술 스택

- **백엔드**: Node.js (Express)
- **오케스트레이션**: Kubernetes + Helm (Bitnami Charts)
- **데이터베이스**: PostgreSQL, MySQL, MariaDB
- **고가용성**: CloudNativePG Operator (PostgreSQL HA)
- **백업/복구**: CSI VolumeSnapshot (hostpath-driver)
- **모니터링**: 실시간 Pod/Helm 상태 추적
- **스토리지**: PVC (minikube hostPath)
- **클러스터**: minikube (로컬 개발용)
- **자동화**: Bash 스크립트 (setup.sh, test-api.sh)

## 📋 개발 로드맵

- [x] 기본 환경 설정
- [x] Node.js API 서버 구현
- [x] Helm 차트 통합
- [x] 기본 DB 인스턴스 배포 테스트
- [x] CSI 백업/복구 기능
- [x] PostgreSQL HA 클러스터 (CloudNativePG Operator)
- [x] 자동 Failover 및 부하 분산
- [ ] MySQL HA 클러스터 (Percona XtraDB Operator)
- [ ] 모니터링 설정 (Prometheus + Grafana)
- [ ] 웹 UI 개발
- [ ] 고급 기능 (Auto Backup, Multi-AZ 등)

## 🎯 지원 기능

### 기본 기능
- DB 인스턴스 생성/삭제/조회
- PostgreSQL HA 클러스터 (CloudNativePG Operator)
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

## 📚 API 엔드포인트

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

### HA 클러스터 API (PostgreSQL 전용)

| 메서드 | 경로 | 설명 | 요청 예시 |
|--------|------|------|-----------|
| `POST` | `/ha-clusters/postgresql` | PostgreSQL HA 클러스터 생성 | [아래 참조](#postgresql-ha-클러스터-생성) |
| `GET` | `/ha-clusters` | 모든 HA 클러스터 목록 | - |
| `GET` | `/ha-clusters/:name/status` | HA 클러스터 상태 조회 | - |
| `POST` | `/ha-clusters/:name/failover` | 수동 Failover 트리거 | - |
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

### PostgreSQL HA 클러스터 생성

#### 기본 HA 클러스터 (3개 노드)
```json
{
  "name": "my-postgres-ha",
  "namespace": "dbaas-postgres-ha",
  "config": {
    "replicas": 3,
    "database": "testdb",
    "username": "dbuser",
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
    "username": "produser",
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

#### 1. PostgreSQL HA 클러스터 생성
```bash
curl -X POST http://localhost:3000/ha-clusters/postgresql \
  -H "Content-Type: application/json" \
  -d '{
    "name": "api-test-pg-cluster",
    "namespace": "dbaas-api-test-pg-ha",
    "config": {
      "replicas": 3,
      "database": "testdb",
      "username": "dbuser",
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
    "status": "Cluster in healthy state",
    "instances": 3,
    "readyInstances": 3,
    "currentPrimary": "api-test-pg-cluster-2",
    "phase": "Running",
    "connections": {
      "rw": "api-test-pg-cluster-rw:5432",
      "ro": "api-test-pg-cluster-ro:5432", 
      "r": "api-test-pg-cluster-r:5432",
      "any": "api-test-pg-cluster-any:5432"
    }
  }
}
```

#### 3. 수동 Failover 트리거
```bash
curl -X POST http://localhost:3000/ha-clusters/api-test-pg-cluster/failover

# 응답 예시
{
  "success": true,
  "message": "Failover triggered successfully",
  "failover": {
    "cluster": "api-test-pg-cluster",
    "newPrimary": "api-test-pg-cluster-3",
    "triggeredAt": "2025-07-19T11:30:15.123Z"
  }
}
```

#### 4. 애플리케이션 연결 방법
```javascript
// Node.js 애플리케이션에서 HA 클러스터 사용
const { Pool } = require('pg');

// 쓰기 작업용 (Primary만)
const writePool = new Pool({
  host: 'api-test-pg-cluster-rw',
  port: 5432,
  user: 'dbuser',
  password: 'postgres123',
  database: 'testdb'
});

// 읽기 작업용 (Standby들만)
const readPool = new Pool({
  host: 'api-test-pg-cluster-ro',
  port: 5432,
  user: 'dbuser', 
  password: 'postgres123',
  database: 'testdb'
});

// 사용 예시
async function createOrder(orderData) {
  // 쓰기는 Primary로
  await writePool.query('INSERT INTO orders (data) VALUES ($1)', [orderData]);
}

async function getProducts() {
  // 읽기는 Standby로 (부하 분산)
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
    "createdAt": "2025-07-19T09:02:15.262Z",
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
      "restoredAt": "2025-07-19T09:07:02.406Z"
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
      "creationTime": "2025-07-19T09:02:10Z",
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

## 🚧 알려진 제한사항

1. **로컬 환경 전용**: 현재는 minikube 기반으로 로컬 개발용
2. **단순 인증**: 기본 비밀번호 기반 인증만 지원
3. **PostgreSQL HA만 지원**: MySQL HA는 아직 개발 중
4. **모니터링 제한**: Prometheus/Grafana 연동 예정
5. **UI 없음**: 현재는 CLI/API만 지원
6. **네트워크 제한**: HA 클러스터는 클러스터 내부 접근만 가능

## 📞 연락처

개발 문의 및 기여는 언제든 환영합니다! 