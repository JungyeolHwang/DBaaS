# 메타데이터 데이터베이스 가이드

Mini DBaaS 시스템에서 메타데이터 데이터베이스를 시작하고 관리하는 방법을 설명합니다.

![Status](https://img.shields.io/badge/Status-Working%20✅-brightgreen)
![Database](https://img.shields.io/badge/Database-PostgreSQL-blue)
![Storage](https://img.shields.io/badge/Storage-CSI%20Hostpath-blue)

## 📋 개요

메타데이터 데이터베이스는 Mini DBaaS의 핵심 구성 요소로, 다음 정보를 저장합니다:
- 생성된 DB 인스턴스 정보
- PostgreSQL HA 클러스터 메타데이터
- 백업 및 복구 이력
- 시스템 설정 정보

## 🚀 빠른 시작

### 전체 과정 요약
```bash
# 1. CSI 드라이버 활성화
minikube addons enable csi-hostpath-driver
minikube addons enable volumesnapshots

# 2. 메타데이터 DB 인스턴스 생성
curl -X POST http://localhost:3000/instances \
  -H "Content-Type: application/json" \
  -d '{"type": "postgresql", "name": "dbaas-metadata", "config": {"password": "dbaas123", "storage": "1Gi", "database": "dbaas_metadata"}}'

# 3. 포트포워딩 설정
kubectl port-forward --namespace dbaas-dbaas-metadata svc/dbaas-metadata-postgresql-local 5434:5432 &

# 4. 메타데이터 DB 초기화
cd backend && node simple-migrate.js
```

## 📝 상세 단계별 가이드

### 1단계: 환경 확인

#### 필수 요구사항
- minikube 실행 중
- kubectl 설정 완료
- Node.js 백엔드 서버 실행 중

```bash
# 환경 확인
minikube status
kubectl get nodes
curl http://localhost:3000/health
```

#### CSI 드라이버 확인
```bash
# CSI 드라이버 상태 확인
minikube addons list | grep csi

# 활성화되지 않은 경우 활성화
minikube addons enable csi-hostpath-driver
minikube addons enable volumesnapshots

# 스토리지 클래스 확인
kubectl get storageclass
```

예상 결과:
```
NAME                 PROVISIONER                RECLAIMPOLICY   VOLUMEBINDINGMODE
csi-hostpath-sc      hostpath.csi.k8s.io        Delete          Immediate
standard (default)   k8s.io/minikube-hostpath   Delete          Immediate
```

### 2단계: 메타데이터 DB 인스턴스 생성

#### API를 통한 생성
```bash
curl -X POST http://localhost:3000/instances \
  -H "Content-Type: application/json" \
  -d '{
    "type": "postgresql", 
    "name": "dbaas-metadata", 
    "config": {
      "password": "dbaas123",
      "storage": "1Gi",
      "database": "dbaas_metadata"
    }
  }'
```

#### 생성 확인
```bash
# Pod 상태 확인
kubectl get pods -n dbaas-dbaas-metadata

# 정상 상태 예시
NAME                                READY   STATUS    RESTARTS   AGE
dbaas-metadata-postgresql-local-0   1/1     Running   0          1m
```

#### 생성 실패 시 문제 해결
```bash
# Pod 상태가 Pending인 경우
kubectl describe pod dbaas-metadata-postgresql-local-0 -n dbaas-dbaas-metadata

# PVC 상태 확인
kubectl get pvc -n dbaas-dbaas-metadata

# 일반적인 해결법: CSI 드라이버 재시작
kubectl delete pod -n kube-system -l app=csi-hostpath-driver
```

### 3단계: 포트포워딩 설정

#### 포트포워딩 실행
```bash
# 메타데이터 DB 포트포워딩 (5434 포트 사용)
kubectl port-forward --namespace dbaas-dbaas-metadata \
  svc/dbaas-metadata-postgresql-local 5434:5432 &
```

#### 연결 확인
```bash
# 포트포워딩 프로세스 확인
ps aux | grep "kubectl port-forward"

# 연결 테스트 (psql이 설치된 경우)
PGPASSWORD=dbaas123 psql -h localhost -p 5434 -U postgres -d dbaas_metadata -c "SELECT 1;"
```

### 4단계: 메타데이터 DB 초기화

#### 마이그레이션 스크립트 실행
```bash
cd backend
node simple-migrate.js
```

#### 성공 시 출력 예시
```
📊 DatabaseService initialized with config: {
  host: 'localhost',
  port: '5434',
  database: 'dbaas_metadata',
  user: 'postgres',
  password: '***'
}
🔄 Starting simple migration...
📝 Creating metadata DB instance in database...
✅ Connected to metadata database successfully
✅ Database schema initialized successfully
✅ Instance created in database: dbaas-metadata
✅ Metadata DB instance migrated successfully
📊 Current instances in database:
┌─────────┬──────────────────┬──────────────┬───────────┬────────────────────────┬──────────┐
│ (index) │ name             │ type         │ status    │ namespace              │ migrated │
├─────────┼──────────────────┼──────────────┼───────────┼────────────────────────┼──────────┤
│ 0       │ 'dbaas-metadata' │ 'postgresql' │ 'running' │ 'dbaas-dbaas-metadata' │ true     │
└─────────┴──────────────────┴──────────────┴───────────┴────────────────────────┴──────────┘
```

## 🔧 문제 해결

### 일반적인 문제들

#### 1. 메타데이터 DB 연결 실패
```bash
❌ Failed to connect to metadata database:
```

**해결 방법:**
1. Pod 상태 확인: `kubectl get pods -n dbaas-dbaas-metadata`
2. 포트포워딩 확인: `ps aux | grep port-forward`
3. 포트포워딩 재시작:
   ```bash
   pkill -f "kubectl port-forward"
   kubectl port-forward --namespace dbaas-dbaas-metadata \
     svc/dbaas-metadata-postgresql-local 5434:5432 &
   ```

#### 2. Pod가 Pending 상태
```bash
kubectl describe pod dbaas-metadata-postgresql-local-0 -n dbaas-dbaas-metadata
```

**일반적인 원인:**
- CSI 드라이버 비활성화
- PVC 생성 실패
- 스토리지 리소스 부족

**해결 방법:**
```bash
# CSI 드라이버 재활성화
minikube addons disable csi-hostpath-driver
minikube addons enable csi-hostpath-driver
minikube addons enable volumesnapshots
```

#### 3. ContainerCreating에서 멈춤
**원인:** 이미지 다운로드 또는 볼륨 마운트 실패

**해결 방법:**
```bash
# 이벤트 확인
kubectl get events -n dbaas-dbaas-metadata --sort-by='.lastTimestamp'

# Pod 로그 확인
kubectl logs dbaas-metadata-postgresql-local-0 -n dbaas-dbaas-metadata
```

#### 4. 포트 충돌
```bash
❌ bind: address already in use
```

**해결 방법:**
```bash
# 5434 포트 사용 프로세스 확인
lsof -i :5434

# 기존 포트포워딩 종료
pkill -f "kubectl port-forward"
```

### 완전 재시작 절차

시스템을 완전히 재시작해야 하는 경우:

```bash
# 1. 모든 프로세스 정리
pkill -f "kubectl port-forward"
pkill -f "node.*index.js"

# 2. 메타데이터 DB 삭제
helm delete dbaas-metadata -n dbaas-dbaas-metadata
kubectl delete namespace dbaas-dbaas-metadata

# 3. CSI 드라이버 재시작
minikube addons disable csi-hostpath-driver
minikube addons enable csi-hostpath-driver
minikube addons enable volumesnapshots

# 4. 처음부터 다시 시작
# (위의 빠른 시작 가이드 따라하기)
```

## 📊 환경 설정

### 환경 변수
메타데이터 DB 연결 설정은 다음 환경 변수로 제어됩니다:

```bash
# backend/services/database.js에서 사용되는 기본값
METADATA_DB_HOST=localhost
METADATA_DB_PORT=5434  # 포트포워딩 포트
METADATA_DB_NAME=dbaas_metadata
METADATA_DB_USER=postgres
METADATA_DB_PASSWORD=dbaas123
```

### 포트 설정
- **Kubernetes 서비스 포트**: 5432 (PostgreSQL 기본 포트)
- **포트포워딩 포트**: 5434 (로컬 접근용)
- **백엔드 연결 포트**: 5434 (DatabaseService 기본 설정)

## 🔄 정기 유지보수

### 백업 권장사항
```bash
# 메타데이터 DB 백업 생성
curl -X POST http://localhost:3000/instances/dbaas-metadata/backup \
  -H "Content-Type: application/json" \
  -d '{"backupName": "metadata-backup-$(date +%Y%m%d)", "retentionDays": "30"}'
```

### 모니터링
```bash
# 메타데이터 DB 상태 확인
curl http://localhost:3000/instances/dbaas-metadata

# 연결 정보 조회
curl http://localhost:3000/instances/dbaas-metadata/connection
```

## 📞 추가 도움

문제가 지속되는 경우:
1. `kubectl get events -A --sort-by='.lastTimestamp'`로 시스템 이벤트 확인
2. `minikube logs`로 minikube 로그 확인
3. Backend 서버 로그에서 상세한 오류 메시지 확인

---

이 가이드는 Mini DBaaS 시스템의 메타데이터 데이터베이스를 안정적으로 운영하기 위한 완전한 참조 문서입니다. 