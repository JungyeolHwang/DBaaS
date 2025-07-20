const { spawn } = require('child_process');
const path = require('path');
const os = require('os');

class PortForwardService {
  constructor() {
    this.activeForwards = new Map(); // instance name -> port info
    this.startPort = 5434; // 5432, 5433은 사용중이므로 5434부터 시작
    this.kubeconfigPath = path.join(os.homedir(), '.kube', 'config');
  }

  // 다음 사용 가능한 포트 찾기
  getNextAvailablePort() {
    const usedPorts = Array.from(this.activeForwards.values()).map(info => info.localPort);
    let port = this.startPort;
    while (usedPorts.includes(port)) {
      port++;
    }
    return port;
  }

  // 인스턴스에 대한 포트 포워딩 시작
  async startPortForward(instanceName, namespace, serviceName, targetPort = 5432) {
    // 이미 포워딩이 활성화되어 있는지 확인
    if (this.activeForwards.has(instanceName)) {
      const existing = this.activeForwards.get(instanceName);
      console.log(`Port forwarding already active for ${instanceName} on port ${existing.localPort}`);
      return existing;
    }

    const localPort = this.getNextAvailablePort();
    
    try {
      console.log(`Starting port forwarding for ${instanceName}: localhost:${localPort} -> ${serviceName}:${targetPort}`);
      
      const command = [
        'port-forward',
        `-n`, namespace,
        `svc/${serviceName}`,
        `${localPort}:${targetPort}`
      ];

      const kubectlProcess = spawn('kubectl', command, {
        env: {
          ...process.env,
          KUBECONFIG: this.kubeconfigPath
        },
        stdio: ['ignore', 'pipe', 'pipe']
      });

      // 프로세스 시작 확인을 위한 약간의 대기
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Port forwarding setup timeout'));
        }, 5000);

        kubectlProcess.stdout.on('data', (data) => {
          const output = data.toString();
          if (output.includes('Forwarding from')) {
            clearTimeout(timeout);
            resolve();
          }
        });

        kubectlProcess.stderr.on('data', (data) => {
          const error = data.toString();
          if (error.includes('unable to listen')) {
            clearTimeout(timeout);
            reject(new Error(`Port forwarding failed: ${error}`));
          }
        });

        kubectlProcess.on('error', (error) => {
          clearTimeout(timeout);
          reject(error);
        });
      });

      const portInfo = {
        instanceName,
        localPort,
        targetPort,
        namespace,
        serviceName,
        process: kubectlProcess,
        startTime: new Date()
      };

      this.activeForwards.set(instanceName, portInfo);
      
      // 프로세스 종료 시 정리
      kubectlProcess.on('exit', () => {
        console.log(`Port forwarding for ${instanceName} ended`);
        this.activeForwards.delete(instanceName);
      });

      return portInfo;
    } catch (error) {
      console.error(`Failed to start port forwarding for ${instanceName}:`, error.message);
      throw error;
    }
  }

  // 인스턴스의 포트 포워딩 중지
  stopPortForward(instanceName) {
    const portInfo = this.activeForwards.get(instanceName);
    if (portInfo) {
      console.log(`Stopping port forwarding for ${instanceName}`);
      portInfo.process.kill();
      this.activeForwards.delete(instanceName);
      return true;
    }
    return false;
  }

  // 특정 인스턴스의 연결 정보 가져오기
  getConnectionInfo(instanceName) {
    const portInfo = this.activeForwards.get(instanceName);
    if (portInfo) {
      return {
        host: 'localhost',
        port: portInfo.localPort,
        targetPort: portInfo.targetPort,
        namespace: portInfo.namespace,
        serviceName: portInfo.serviceName,
        status: 'active',
        startTime: portInfo.startTime
      };
    }
    return null;
  }

  // 모든 활성 포트 포워딩 목록
  getAllActiveForwards() {
    return Array.from(this.activeForwards.entries()).map(([name, info]) => ({
      instanceName: name,
      localPort: info.localPort,
      targetPort: info.targetPort,
      namespace: info.namespace,
      serviceName: info.serviceName,
      startTime: info.startTime
    }));
  }

  // 모든 포트 포워딩 정리
  cleanup() {
    console.log('Cleaning up all port forwards...');
    for (const [instanceName, portInfo] of this.activeForwards) {
      portInfo.process.kill();
    }
    this.activeForwards.clear();
  }
}

module.exports = new PortForwardService(); 