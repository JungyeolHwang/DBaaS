# 🎯 Helm 차트 핵심 개념 가이드

## 📋 목차
1. [차트 구조](#차트-구조)
2. [Chart.yaml](#chartyaml---차트-메타데이터)
3. [values.yaml](#valuesyaml---설정값들)
4. [템플릿](#템플릿-templates)
5. [Helm 템플릿 문법](#helm-템플릿-문법)
6. [_helpers.tpl](#_helperstpl---공통-함수)
7. [Helm 핵심 개념들](#helm의-핵심-개념들)
8. [Helm 라이프사이클](#helm-라이프사이클)
9. [실제 사용 예시](#실제-사용-예시)
10. [핵심 정리](#핵심-정리)

---

## 1. 📁 차트 구조 (Chart Structure)

우리가 만든 PostgreSQL 로컬 차트의 구조:

```
postgresql-local/
├── Chart.yaml          # 차트 메타데이터
├── values.yaml          # 기본 설정값들
├── templates/           # Kubernetes 매니페스트 템플릿들
│   ├── deployment.yaml  # StatefulSet 정의
│   ├── service.yaml     # 서비스 정의
│   ├── secret.yaml      # Secret 정의
│   ├── _helpers.tpl     # 공통 함수들
│   └── NOTES.txt        # 설치 완료 메시지
└── charts/              # 의존성 차트들
```

---

## 2. 🔧 Chart.yaml - 차트 메타데이터

```yaml
apiVersion: v2
name: postgresql-local
description: A Helm chart for Kubernetes
type: application
version: 0.1.0          # 차트 버전 (차트 자체 버전)
appVersion: "1.16.0"    # 애플리케이션 버전 (PostgreSQL 버전)
```

**주요 필드:**
- `name`: 차트 이름
- `version`: 차트 버전 (차트 자체 버전)
- `appVersion`: 애플리케이션 버전 (PostgreSQL 버전)
- `type`: application/library 타입

---

## 3. ⚙️ values.yaml - 설정값들

```yaml
# PostgreSQL 이미지 설정
image:
  repository: postgres
  tag: "15"
  pullPolicy: IfNotPresent

# PostgreSQL 인증 설정  
auth:
  postgresPassword: "defaultpassword"
  database: "defaultdb"
  username: "postgres"

# 서비스 설정
service:
  type: ClusterIP
  port: 5432
```

**values.yaml 역할:**
- 차트의 **기본 설정값** 정의
- `--set` 옵션으로 **오버라이드 가능**
- **계층적 구조**로 설정 관리

---

## 4. 📝 템플릿 (Templates)

템플릿 예시 (deployment.yaml 일부):

```yaml
containers:
  - name: postgresql
    {{- with .Values.securityContext }}
    securityContext:
      {{- toYaml . | nindent 12 }}
    {{- end }}
    image: "{{ .Values.image.repository }}:{{ .Values.image.tag }}"
    imagePullPolicy: {{ .Values.image.pullPolicy }}
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
```

---

## 5. 🔧 Helm 템플릿 문법

### 주요 문법들:

#### 값 참조
```yaml
{{ .Values.image.repository }}
```

#### 조건문
```yaml
{{- if .Values.persistence.enabled }}
...
{{- end }}
```

#### 반복문
```yaml
{{- range .Values.persistence.accessModes }}
- {{ . | quote }}
{{- end }}
```

#### 함수 호출
```yaml
{{ include "postgresql-local.fullname" . }}
```

#### 파이프 (값 변환)
```yaml
{{ .Values.auth.database | quote }}
{{ .Values.securityContext | toYaml | nindent 12 }}
```

---

## 6. 🛠 _helpers.tpl - 공통 함수

```yaml
{{/*
Expand the name of the chart.
*/}}
{{- define "postgresql-local.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
*/}}
{{- define "postgresql-local.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}
```

**_helpers.tpl 역할:**
- **재사용 가능한 함수** 정의
- **이름 생성 규칙** 표준화
- **라벨, 셀렉터** 일관성 보장

---

## 7. 🎯 Helm의 핵심 개념들

### A. 릴리스 (Release)
```bash
helm install my-postgres ./postgresql-local
# "my-postgres" = 릴리스 이름
```

### B. 값 오버라이드 (Values Override)
```bash
# 명령어로 값 변경
helm install pg1 ./postgresql-local --set auth.postgresPassword=secret123

# 파일로 값 변경
helm install pg1 ./postgresql-local -f custom-values.yaml
```

### C. 템플릿 렌더링
```bash
# 실제 배포 전 YAML 미리보기
helm template pg1 ./postgresql-local
```

---

## 8. 🔄 Helm 라이프사이클

```
📝 Chart 개발 → 🔍 Template 검증 → 📦 Chart 패키징
    ↓
🚀 helm install → ⚙️ Kubernetes 배포
    ↓
🔄 helm upgrade → 📊 helm status → 🗑️ helm uninstall
```

### 단계별 설명:
- **개발 단계**: Chart 개발, Template 검증, Chart 패키징
- **배포 단계**: helm install, Kubernetes 배포
- **관리 단계**: helm upgrade, helm status, helm uninstall

---

## 9. 📚 실제 사용 예시

### 우리 DBaaS에서 실제로 사용하는 방법:

```javascript
// k8s.js에서 사용
const chartPath = path.join(chartBasePath, 'postgresql-local');
const helmCommand = `helm install ${name} "${chartPath}" 
  --namespace ${namespace} 
  --set auth.postgresPassword=${password}
  --set auth.database=${database}`;
```

### 일반적인 Helm 명령어들:

```bash
# 차트 설치
helm install my-db ./postgresql-local

# 설정값 오버라이드
helm install my-db ./postgresql-local \
  --set auth.postgresPassword=mypassword \
  --set persistence.size=5Gi

# 상태 확인
helm status my-db

# 업그레이드
helm upgrade my-db ./postgresql-local --set image.tag=16

# 삭제
helm uninstall my-db

# 템플릿 미리보기
helm template my-db ./postgresql-local
```

---

## 10. 🎯 핵심 정리

| 개념 | 역할 | 우리 예시 |
|------|------|-----------|
| **Chart.yaml** | 차트 메타데이터 | `postgresql-local`, `version: 0.1.0` |
| **values.yaml** | 기본 설정값 | `auth.postgresPassword`, `image.tag` |
| **Templates** | K8s 매니페스트 템플릿 | `deployment.yaml`, `service.yaml` |
| **Helpers** | 재사용 함수 | `postgresql-local.fullname` |
| **Release** | 배포된 인스턴스 | `test-local-pg2` |
| **Override** | 설정값 변경 | `--set auth.password=custom` |

---

## 💡 추가 팁

### 1. 차트 검증
```bash
# 차트 문법 검사
helm lint ./postgresql-local

# 템플릿 렌더링 테스트
helm template test ./postgresql-local --debug
```

### 2. 값 확인
```bash
# 현재 설정값 확인
helm get values my-db

# 모든 설정값 확인 (기본값 포함)
helm get values my-db --all
```

### 3. 디버깅
```bash
# 상세 로그와 함께 설치
helm install my-db ./postgresql-local --debug --dry-run

# 릴리스 히스토리
helm history my-db
```

---

## 🚀 결론

Helm 차트를 이해하면:
- ✅ **완전 오프라인**: 인터넷 없이도 DB 인스턴스 생성 가능
- ⚡ **빠른 배포**: 원격 다운로드 없어서 배포 속도 향상  
- 🔒 **버전 일관성**: 로컬 차트로 예측 가능한 동작
- 🛠 **커스터마이징 가능**: 필요에 따라 차트 직접 수정 가능

이제 Helm 차트를 완전히 이해하고 커스터마이징할 수 있습니다! 🎉 