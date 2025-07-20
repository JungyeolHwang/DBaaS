#!/bin/bash

# Mini DBaaS API 테스트 스크립트

API_URL="http://localhost:3000"

# 색상 코드
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "🧪 Mini DBaaS API 테스트를 시작합니다..."

# 함수: 테스트 결과 출력
test_result() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✅ $2${NC}"
    else
        echo -e "${RED}❌ $2${NC}"
    fi
}

# 1. 헬스체크
echo "📡 헬스체크 테스트..."
curl -s "$API_URL/health" > /dev/null
test_result $? "헬스체크"

# 2. 루트 엔드포인트
echo "🏠 루트 엔드포인트 테스트..."
curl -s "$API_URL/" > /dev/null
test_result $? "루트 엔드포인트"

# 3. 인스턴스 목록 조회 (빈 목록)
echo "📋 인스턴스 목록 조회..."
response=$(curl -s "$API_URL/instances")
echo "응답: $response"

# 4. PostgreSQL 인스턴스 생성 테스트
echo "🐘 PostgreSQL 인스턴스 생성 테스트..."
create_response=$(curl -s -X POST "$API_URL/instances" \
  -H "Content-Type: application/json" \
  -d '{"type": "postgresql", "name": "test-pg", "config": {"password": "testpass123", "storage": "1Gi"}}')

echo "생성 응답: $create_response"

# 5. 잠시 대기 (인스턴스 생성 시간)
echo "⏳ 인스턴스 생성을 위해 30초 대기..."
sleep 30

# 6. 생성된 인스턴스 상태 확인
echo "🔍 인스턴스 상태 확인..."
status_response=$(curl -s "$API_URL/instances/test-pg")
echo "상태 응답: $status_response"

# 7. 연결 정보 조회
echo "🔗 연결 정보 조회..."
connection_response=$(curl -s "$API_URL/instances/test-pg/connection")
echo "연결 정보: $connection_response"

# 8. 인스턴스 삭제 (선택사항)
echo ""
echo -e "${YELLOW}인스턴스를 삭제하시겠습니까? (y/N)${NC}"
read -r answer
if [[ $answer =~ ^[Yy]$ ]]; then
    echo "🗑️ 인스턴스 삭제..."
    delete_response=$(curl -s -X DELETE "$API_URL/instances/test-pg")
    echo "삭제 응답: $delete_response"
fi

echo ""
echo "🎉 API 테스트 완료!"
echo ""
echo "💡 유용한 테스트 명령어:"
echo "  curl $API_URL/health                    # 헬스체크"
echo "  curl $API_URL/instances                 # 인스턴스 목록"
echo "  kubectl get pods -A | grep dbaas        # 생성된 Pod 확인"
echo "  helm list -A                            # Helm 릴리스 확인" 