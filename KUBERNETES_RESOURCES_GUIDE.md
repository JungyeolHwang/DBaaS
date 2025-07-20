# ��️ Kubernetes 리소스 타입 완전 가이드

> **StatefulSet, Service, Secret의 역할과 Mini DBaaS에서의 활용**

![Status](https://img.shields.io/badge/Status-Working%20✅-brightgreen)
![Kubernetes](https://img.shields.io/badge/Kubernetes-v1.32.2-blue)
![Helm](https://img.shields.io/badge/Helm-v3.18.4-blue)
![MiniKube](https://img.shields.io/badge/MiniKube-v1.36.0-blue)

## 📋 목차

1. [개요](#1-개요)
2. [StatefulSet - 상태 유지 애플리케이션](#2-statefulset---상태-유지-애플리케이션)
3. [Service - 네트워크 연결 관리](#3-service---네트워크-연결-관리)
4. [Secret - 민감한 정보 관리](#4-secret---민감한-정보-관리)
5. [리소스 간 상호작용](#5-리소스-간-상호작용)
6. [Helm 차트 vs Operator 비교](#6-helm-차트-vs-operator-비교)
7. [실제 사용 예시](#7-실제-사용-예시)
8. [핵심 정리](#8-핵심-정리)

---

## 1. 개요

Kubernetes에서 애플리케이션을 실행하고 관리하기 위해서는 여러 리소스 타입이 필요합니다. 이 가이드에서는 Mini DBaaS 프로젝트에서 사용하는 **StatefulSet**, **Service**, **Secret**의 역할과 활용법을 설명합니다.

### 🎯 핵심 개념

```markdown:KUBERNETES_RESOURCES_GUIDE.md
애플리케이션 배포 = StatefulSet (Pod 관리) + Service (네트워크) + Secret (보안)
```

| 리소스 | 역할 | 예시 | 특징 |
|--------|------|------|------|
| **StatefulSet** | 상태 유지 애플리케이션 | PostgreSQL Pod | 고유 이름, 영구 스토리지 |
| **Service** | 네트워크 연결 | PostgreSQL 서비스 | 고정 IP, 로드밸런싱 |
| **Secret** | 민감한 정보 | 비밀번호, 인증서 | 암호화, RBAC 보안 |

---

## 2. StatefulSet - 상태 유지 애플리케이션

### 🎯 역할
데이터베이스처럼 **상태를 유지해야 하는 애플리케이션**을 관리하는 리소스입니다.

### ✅ 주요 특징
- **고유한 식별자**: 각 Pod가 고유한 이름과 네트워크 ID
- **순서 보장**: Pod가 순서대로 생성/삭제됨
- **영구 스토리지**: Pod가 재시작되어도 데이터 유지
- **안정적인 네트워크**: Pod 이름이 DNS 이름으로 사용됨

###  현재 프로젝트에서의 사용

```yaml
# helm-charts/postgresql-local/templates/deployment.yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: {{ include "postgresql-local.fullname" . }}
spec:
  serviceName: {{ include "postgresql-local.fullname" . }}
  replicas: {{ .Values.replicaCount }}  # 보통 1개
  selector:
    matchLabels:
      {{- include "postgresql-local.selectorLabels" . | nindent 6 }}
  template:
    spec:
      containers:
      - name: postgresql
        image: "{{ .Values.image.repository }}:{{ .Values.image.tag }}"
        ports:
        - name: postgresql
          containerPort: {{ .Values.service.port }}
          protocol: TCP
        env:
        - name: POSTGRES_PASSWORD
          valueFrom:
            secretKeyRef:
              name: {{ include "postgresql-local.fullname" . }}-secret
              key: postgres-password
        - name: POSTGRES_DB
          value: {{ .Values.auth.database | quote }}
        volumeMounts:
        - name: data
          mountPath: /var/lib/postgresql/data  # 데이터 저장 위치
  volumeClaimTemplates:  # 각 Pod마다 독립적인 PVC 생성
  - metadata:
      name: data
    spec:
      accessModes: ["ReadWriteOnce"]
      resources:
        requests:
          storage: {{ .Values.persistence.size }}
```

### 💡 Deployment vs StatefulSet 비교

```bash
# 일반 Deployment (웹 서버용)
Deployment:
- Pod 이름: web-app-abc123, web-app-def456 (랜덤)
- 스토리지: 공유 가능
- 네트워크: 로드밸런서 뒤에서 교체 가능
- 용도: 무상태 애플리케이션

# StatefulSet (데이터베이스용)
StatefulSet:
- Pod 이름: postgres-0, postgres-1, postgres-2 (고정)
- 스토리지: 각 Pod마다 독립적
- 네트워크: postgres-0.my-postgres.namespace.svc.cluster.local
- 용도: 상태 유지 애플리케이션
```

###  StatefulSet의 고유 기능

#### 1. 순서 보장
```bash
# Pod 생성 순서
postgres-0 → postgres-1 → postgres-2

# Pod 삭제 순서 (역순)
postgres-2 → postgres-1 → postgres-0
```

#### 2. 고정된 네트워크 ID
```bash
# 각 Pod의 DNS 이름
postgres-0.my-postgres.namespace.svc.cluster.local
postgres-1.my-postgres.namespace.svc.cluster.local
postgres-2.my-postgres.namespace.svc.cluster.local
```

#### 3. 독립적인 스토리지
```bash
# 각 Pod마다 독립적인 PVC
data-postgres-0-pvc
data-postgres-1-pvc
data-postgres-2-pvc
```

---

## 3. Service - 네트워크 연결 관리

### 🎯 역할
Pod들에 대한 **안정적인 네트워크 엔드포인트**를 제공하는 리소스입니다.

### ✅ 주요 특징
- **고정 IP**: Pod가 재시작되어도 서비스 IP는 유지
- **로드밸런싱**: 여러 Pod에 트래픽 분산
- **서비스 디스커버리**: DNS 이름으로 Pod 찾기
- **포트 매핑**: 외부 포트를 Pod 포트로 연결

###  현재 프로젝트에서의 사용

```yaml
# helm-charts/postgresql-local/templates/service.yaml
apiVersion: v1
kind: Service
metadata:
  name: {{ include "postgresql-local.fullname" . }}
  labels:
    {{- include "postgresql-local.labels" . | nindent 4 }}
spec:
  type: {{ .Values.service.type }}  # ClusterIP (내부 접근용)
  ports:
  - port: {{ .Values.service.port }}      # 5432 (외부 포트)
    targetPort: postgresql                # 컨테이너 포트
    protocol: TCP
    name: postgresql
  selector:
    {{- include "postgresql-local.selectorLabels" . | nindent 4 }}
```

###  서비스 타입별 차이

#### 1. ClusterIP (기본값) - 내부 접근만
```bash
kubectl get svc my-postgres
# NAME         TYPE        CLUSTER-IP      PORT(S)
# my-postgres  ClusterIP   10.96.1.100     5432/TCP

# 클러스터 내부에서만 접근 가능
psql -h my-postgres -p 5432 -U postgres
```

#### 2. NodePort - 외부 접근 가능
```bash
kubectl patch svc my-postgres -p '{"spec":{"type":"NodePort"}}'
# NAME         TYPE       CLUSTER-IP      PORT(S)
# my-postgres  NodePort   10.96.1.100     5432:30001/TCP

# 외부에서 접근 가능 (노드 IP:30001)
psql -h <minikube-ip> -p 30001 -U postgres
```

#### 3. LoadBalancer - 클라우드 로드밸런서
```bash
kubectl patch svc my-postgres -p '{"spec":{"type":"LoadBalancer"}}'
# NAME         TYPE           CLUSTER-IP      PORT(S)
# my-postgres  LoadBalancer   10.96.1.100     5432:30001/TCP

# 클라우드 로드밸런서 IP로 접근
psql -h <loadbalancer-ip> -p 5432 -U postgres
```

###  실제 연결 예시

#### 클러스터 내부 연결
```bash
# 다른 Pod에서 연결
psql -h my-postgres -p 5432 -U postgres -d mydb

# 전체 DNS 이름으로 연결
psql -h my-postgres.dbaas-my-postgres.svc.cluster.local -p 5432
```

#### 포트포워딩으로 로컬 접근
```bash
# 로컬에서 접근하기 위한 포트포워딩
kubectl port-forward svc/my-postgres 5432:5432

# 로컬에서 연결
psql -h localhost -p 5432 -U postgres -d mydb
```

#### 서비스 디스커버리
```bash
# DNS 조회
nslookup my-postgres
# Server: 10.96.0.10
# Address: 10.96.0.10#53
# Name: my-postgres.dbaas-my-postgres.svc.cluster.local
# Address: 10.96.1.100
```

---

## 4. Secret - 민감한 정보 관리

### 🎯 역할
비밀번호, API 키 등 **민감한 정보를 안전하게 저장**하는 리소스입니다.

### ✅ 주요 특징
- **암호화 저장**: base64로 인코딩되어 저장
- **RBAC 보안**: 권한이 있는 사용자만 접근
- **Pod 주입**: 환경변수나 파일로 Pod에 전달
- **타입별 관리**: Opaque, kubernetes.io/basic-auth 등

###  현재 프로젝트에서의 사용

```yaml
# helm-charts/postgresql-local/templates/secret.yaml
apiVersion: v1
kind: Secret
metadata:
  name: {{ include "postgresql-local.fullname" . }}-secret
  labels:
    {{- include "postgresql-local.labels" . | nindent 4 }}
type: Opaque
data:
  postgres-password: {{ .Values.auth.postgresPassword | b64enc | quote }}
```

**StatefulSet에서 Secret 사용**:
```yaml
# deployment.yaml에서 Secret 참조
containers:
- name: postgresql
  env:
  - name: POSTGRES_PASSWORD
    valueFrom:
      secretKeyRef:
        name: {{ include "postgresql-local.fullname" . }}-secret
        key: postgres-password
  - name: POSTGRES_DB
    value: {{ .Values.auth.database | quote }}
  - name: POSTGRES_USER
    value: {{ .Values.auth.username | quote }}
```

### 💡 Secret 타입별 사용법

#### 1. Opaque (기본) - 임의의 키-값 쌍
```yaml
apiVersion: v1
kind: Secret
metadata:
  name: my-secret
type: Opaque
data:
  username: YWRtaW4=        # admin (base64)
  password: cGFzc3dvcmQ=    # password (base64)
```

#### 2. kubernetes.io/basic-auth - 사용자명/비밀번호
```yaml
apiVersion: v1
kind: Secret
metadata:
  name: db-credentials
type: kubernetes.io/basic-auth
data:
  username: YWRtaW4=        # admin
  password: cGFzc3dvcmQ=    # password
```

#### 3. kubernetes.io/tls - SSL 인증서
```yaml
apiVersion: v1
kind: Secret
metadata:
  name: tls-secret
type: kubernetes.io/tls
data:
  tls.crt: <base64-encoded-cert>
  tls.key: <base64-encoded-key>
```

### 🔐 Secret 관리 명령어

#### Secret 생성
```bash
# 명령어로 생성
kubectl create secret generic my-secret \
  --from-literal=username=admin \
  --from-literal=password=secret123

# 파일로 생성
kubectl create secret generic my-secret \
  --from-file=username.txt \
  --from-file=password.txt
```

#### Secret 조회
```bash
# Secret 목록
kubectl get secrets

# Secret 상세 정보
kubectl describe secret my-secret

# Secret 값 확인 (base64 디코딩)
kubectl get secret my-secret -o jsonpath='{.data.password}' | base64 -d
```

#### Secret 업데이트
```bash
# Secret 값 변경
kubectl patch secret my-secret -p '{"data":{"password":"bmV3cGFzc3dvcmQ="}}'

# Pod 재시작으로 새 값 적용
kubectl rollout restart statefulset/my-postgres
```

---

## 5. 리소스 간 상호작용

### 🔄 전체 흐름

```bash
1. Secret 생성
   ↓ (비밀번호 저장)
2. StatefulSet 생성
   ↓ (Pod + PVC 생성)
3. Service 생성
   ↓ (네트워크 엔드포인트 제공)
4. 애플리케이션 연결
```

### 📊 실제 예시

#### PostgreSQL 인스턴스 생성 과정
```bash
# 1. API 요청
curl -X POST http://localhost:3000/instances \
  -d '{"type": "postgresql", "name": "my-db", "config": {"password": "secret123"}}'

# 2. Helm이 자동으로 생성하는 리소스들:
kubectl get secret my-db-postgresql-local-secret
# NAME                           TYPE     DATA   AGE
# my-db-postgresql-local-secret  Opaque   1      1m

kubectl get statefulset my-db-postgresql-local
# NAME                        READY   AGE
# my-db-postgresql-local      1/1     1m

kubectl get service my-db-postgresql-local
# NAME                        TYPE        CLUSTER-IP      PORT(S)
# my-db-postgresql-local      ClusterIP   10.96.1.100     5432/TCP

kubectl get pvc -l app.kubernetes.io/instance=my-db
# NAME                                    STATUS   VOLUME   CAPACITY
# data-my-db-postgresql-local-0          Bound    pvc-abc   1Gi
```

#### 연결 과정
```bash
# 1. 애플리케이션이 서비스에 연결
psql -h my-db-postgresql-local -p 5432

# 2. 서비스가 Pod로 트래픽 전달
my-db-postgresql-local → my-db-postgresql-local-0

# 3. Pod에서 Secret의 비밀번호 사용
POSTGRES_PASSWORD=secret123 (Secret에서 가져옴)

# 4. 데이터는 PVC에 저장
/var/lib/postgresql/data → data-my-db-postgresql-local-0
```

###  리소스 의존성

```yaml
# 의존성 순서
Secret (비밀번호) 
    ↓
StatefulSet (Pod + PVC)
    ↓
Service (네트워크)
    ↓
애플리케이션 연결
```

---

## 6. Helm 차트 vs Operator 비교

### 📦 Helm 차트 (단일 인스턴스)

**구조**: 1:1:1 관계
```yaml
# 1개 StatefulSet + 1개 Service + 1개 Secret
StatefulSet: my-postgres-postgresql-local (replicas: 1)
Service: my-postgres-postgresql-local (ClusterIP)
Secret: my-postgres-postgresql-local-secret
```

**특징**:
- ✅ **간단한 구조**: 단일 인스턴스만 관리
- ✅ **예측 가능**: 정적 배포, 변경 없음
- ✅ **빠른 배포**: 복잡한 로직 없음
- ❌ **제한된 기능**: HA, 자동 복구 없음

### 🤖 Operator (HA 클러스터)

**구조**: N:M:1 관계
```yaml
# 3개 StatefulSet + 4개 Service + 1개 Secret
StatefulSet: postgres-cluster-0, postgres-cluster-1, postgres-cluster-2
Service: postgres-cluster-rw, postgres-cluster-ro, postgres-cluster-r, postgres-cluster-any
Secret: postgres-credentials
```

**특징**:
- ✅ **고급 기능**: HA, 자동 Failover, 부하 분산
- ✅ **동적 관리**: 실시간 상태 감시 및 조정
- ✅ **복잡한 로직**: 복제 설정, 장애 복구
- ❌ **복잡한 구조**: 여러 리소스 간 복잡한 관계

### 🔄 실제 매니페스트 비교

#### Helm 차트 방식
```yaml
# 단일 PostgreSQL 인스턴스
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: my-postgres-postgresql-local
spec:
  replicas: 1  # 항상 1개만
  template:
    spec:
      containers:
      - name: postgresql
        image: postgres:15
        env:
        - name: POSTGRES_PASSWORD
          valueFrom:
            secretKeyRef:
              name: my-postgres-postgresql-local-secret
              key: postgres-password
```

#### Operator 방식
```yaml
# PostgreSQL HA 클러스터
apiVersion: acid.zalan.do/v1
kind: postgresql
metadata:
  name: postgres-cluster
spec:
  numberOfInstances: 3  # 3개 노드
  users:
    admin:
      - superuser
      - createdb
  databases:
    testdb: admin
  postgresql:
    version: "15"
```

---

## 7. 실제 사용 예시

###  시나리오 1: 개발자 개인 프로젝트

**목표**: 간단한 PostgreSQL 인스턴스 생성

```bash
# 1. Helm 차트로 단일 인스턴스 생성
helm install my-dev-db ./helm-charts/postgresql-local \
  --set auth.postgresPassword=dev123 \
  --set persistence.size=1Gi

# 2. 생성된 리소스 확인
kubectl get statefulset my-dev-db-postgresql-local
kubectl get service my-dev-db-postgresql-local
kubectl get secret my-dev-db-postgresql-local-secret

# 3. 연결 테스트
kubectl port-forward svc/my-dev-db-postgresql-local 5432:5432 &
psql -h localhost -p 5432 -U postgres -d defaultdb
```

###  시나리오 2: 프로덕션 웹 서비스

**목표**: 고가용성 PostgreSQL 클러스터 생성

```bash
# 1. Zalando Operator로 HA 클러스터 생성
kubectl apply -f k8s/operators/production-ha-postgres-cluster.yaml

# 2. 생성된 리소스 확인
kubectl get postgresql production-ha-cluster -n dbaas-production-ha
kubectl get pods -n dbaas-production-ha
kubectl get services -n dbaas-production-ha

# 3. 서비스별 연결 테스트
# 쓰기 작업 (Primary)
psql -h production-ha-cluster-rw -p 5432 -U admin -d proddb

# 읽기 작업 (Standby)
psql -h production-ha-cluster-ro -p 5432 -U admin -d proddb
```

### 🔧 디버깅 명령어

#### 리소스 상태 확인
```bash
# 모든 리소스 상태 확인
kubectl get all -n <namespace>

# 특정 리소스 상세 정보
kubectl describe statefulset <name>
kubectl describe service <name>
kubectl describe secret <name>

# Pod 로그 확인
kubectl logs -f <pod-name> -n <namespace>
```

#### 네트워크 연결 테스트
```bash
# 서비스 연결 테스트
kubectl run test-pod --image=postgres:15 --rm -it -- bash
psql -h <service-name> -p 5432 -U postgres

# DNS 확인
nslookup <service-name>
```

#### Secret 값 확인
```bash
# Secret 값 디코딩
kubectl get secret <secret-name> -o jsonpath='{.data.password}' | base64 -d

# 환경변수로 Secret 사용 확인
kubectl exec <pod-name> -- env | grep POSTGRES
```

---

## 8. 핵심 정리

###  리소스 역할 요약

| 리소스 | 역할 | 예시 | 특징 |
|--------|------|------|------|
| **StatefulSet** | 상태 유지 애플리케이션 | PostgreSQL Pod | 고유 이름, 영구 스토리지 |
| **Service** | 네트워크 연결 | PostgreSQL 서비스 | 고정 IP, 로드밸런싱 |
| **Secret** | 민감한 정보 | 비밀번호, 인증서 | 암호화, RBAC 보안 |

###  사용 패턴

#### 단순한 애플리케이션 (Helm 차트)
```bash
1:1:1 구조
StatefulSet (1개) + Service (1개) + Secret (1개)
```

#### 복잡한 애플리케이션 (Operator)
```bash
N:M:1 구조
StatefulSet (N개) + Service (M개) + Secret (1개)
```

###  모범 사례

#### 1. 보안
- ✅ Secret을 사용하여 민감한 정보 관리
- ✅ RBAC으로 접근 권한 제한
- ✅ 정기적인 비밀번호 변경

#### 2. 네트워크
- ✅ ClusterIP로 내부 접근 제한
- ✅ 포트포워딩으로 로컬 개발
- ✅ LoadBalancer로 외부 접근

#### 3. 스토리지
- ✅ StatefulSet으로 영구 스토리지 보장
- ✅ 적절한 스토리지 크기 설정
- ✅ 백업 정책 수립

### 🚀 다음 단계

이제 Kubernetes 리소스 타입을 이해했으므로:

1. **Helm 차트 커스터마이징**: values.yaml 수정으로 설정 변경
2. **Operator 활용**: 고급 기능을 위한 Operator 학습
3. **모니터링 설정**: Prometheus + Grafana 연동
4. **보안 강화**: TLS 인증서, 네트워크 정책 적용

---

> **작성일**: 2025-01-27  
> **버전**: 1.0  
> **테스트 환경**: minikube v1.36.0, Kubernetes v1.32.2  
> **적용 범위**: Mini DBaaS 프로젝트 전체 
```

이제 이 문서를 프로젝트에 추가하겠습니다. README.md에서 이 가이드를 참조할 수 있도록 링크도 추가해드릴까요? 