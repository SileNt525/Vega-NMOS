import { useEffect, useState } from 'react';
import { w3cwebsocket as W3CWebSocket } from 'websocket';

export default function NmosSubscription({ onUpdate }) {
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [wsClient, setWsClient] = useState(null);

  useEffect(() => {
    // 连接到后端的WebSocket服务
    const client = new W3CWebSocket(`ws://${window.location.hostname}:${window.location.port}/api/v1/ws/updates`);
    
    client.onopen = () => {
      console.log('WebSocket Connected');
      setConnectionStatus('connected');
    };
    
    client.onmessage = (message) => {
      const data = JSON.parse(message.data);
      
      if (data.type === 'nmos_resource_update') {
        // 处理NMOS资源更新
        onUpdate(data.topic, data.changes);
      } else if (data.type === 'nmos_connection_status') {
        // 更新连接状态
        setConnectionStatus(data.status);
      }
    };
    
    client.onclose = () => {
      console.log('WebSocket Disconnected');
      setConnectionStatus('disconnected');
    };
    
    client.onerror = (error) => {
      console.error('WebSocket Error:', error);
      setConnectionStatus('error');
    };
    
    setWsClient(client);
    
    return () => {
      if (client) {
        client.close();
      }
    };
  }, [onUpdate]);

  return (
    <div className="subscription-status">
      <span className={`status-indicator ${connectionStatus}`}></span>
      <span className="status-text">
        {connectionStatus === 'connected' ? '已连接' : 
         connectionStatus === 'disconnected' ? '已断开' : 
         connectionStatus === 'error' ? '连接错误' : '连接中...'}
      </span>
    </div>
  );
}