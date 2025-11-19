import { useState, useEffect, useCallback } from 'react'; // Removed useMemo
import './App.css';
import NmosSubscription from './components/NmosSubscription.jsx';
import NodeDisplay from './components/NodeDisplay.jsx';
import EventRules from './components/EventRules.jsx';
import ChannelMapping from './components/ChannelMapping.jsx';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faExclamationTriangle } from '@fortawesome/free-solid-svg-icons';
// Removed unused icons: faSatelliteDish, faBroadcastTower, faLink from App.jsx as they are now in cards

function App() {
  const [senders, setSenders] = useState([]); // Still needed for handleConnect dropdown
  const [receivers, setReceivers] = useState([]); // Still needed for handleConnect dropdown and activeRoutes
  const [nodes, setNodes] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [registryUrl, setRegistryUrl] = useState('');
  const [activeRoutes, setActiveRoutes] = useState({});
  const [notification, setNotification] = useState('');
  const [highlight, setHighlight] = useState('');
  const [activeTab, setActiveTab] = useState('routing'); // routing, rules, mapping

  const fetchResources = useCallback(async (isRefresh = false, customUrl = null) => {
    setIsLoading(true);
    setError(null);
    // Nodes, Senders, Receivers will be reset here before fetching
    setNodes([]);
    setSenders([]);
    setReceivers([]);
    const urlToUse = customUrl || registryUrl;
    if (!urlToUse || (!urlToUse.startsWith('http://') && !urlToUse.startsWith('https://'))) {
      setError('无效的注册表URL。必须以http://或https://开头');
      setIsLoading(false);
      // Already reset states at the beginning of the function
      return;
    }

    try {
      const apiUrl = '/api/is04/discover';
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ registryUrl: urlToUse }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: `HTTP错误！状态：${response.status}` }));
        throw new Error(errorData.message || `HTTP错误！状态：${response.status}`);
      }
      const data = await response.json();

      if (data.data && data.data.nodes) {
        setNodes(data.data.nodes);

        // Create flat lists for senders and receivers for SenderCard dropdown and activeRoutes logic
        let flatSenders = [];
        let flatReceivers = [];
        data.data.nodes.forEach(node => {
          if (node.devices && Array.isArray(node.devices)) {
            node.devices.forEach(device => {
              if (device.senders && Array.isArray(device.senders)) {
                flatSenders.push(...device.senders);
              }
              if (device.receivers && Array.isArray(device.receivers)) {
                flatReceivers.push(...device.receivers);
              }
            });
          }
        });
        setSenders(flatSenders); // Used by SenderCard for dropdown
        setReceivers(flatReceivers); // Used by SenderCard for dropdown & for activeRoutes logic
      } else {
        // States already reset if structure is not as expected
        console.warn("API response did not contain expected nodes structure:", data);
      }

      alert(data.message || '资源获取成功！');
      setError(null);
    } catch (e) {
      console.error("获取IS-04资源失败：", e);
      setError(`加载资源失败：${e.message}。请确保后端正在运行且NMOS_REGISTRY_URL可被后端访问。`);
      // States already reset at the beginning or if data.data.nodes is missing
    }
    setIsLoading(false);
  }, [registryUrl]); // Removed pagination dependencies

  useEffect(() => {
    // if (registryUrl) fetchResources(false, registryUrl); // Manual trigger is preferred
  }, [registryUrl, fetchResources]);


  const handleStopConnection = async () => {
    setIsLoading(true);
    setError(null);
    setNodes([]); // Clear nodes immediately
    setSenders([]);
    setReceivers([]);
    setNotification('正在尝试停止与注册表的连接...');

    try {
      const response = await fetch('/api/nmos/stop-registry', { method: 'POST' });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || `停止连接失败，状态：${response.status}`);
      }
      setNotification(result.message || '成功停止与注册表的连接。');
      // States already cleared at the beginning of this function
    } catch (e) {
      console.error("停止连接失败：", e);
      setError(`停止连接错误：${e.message}`);
      // States should have been cleared already, but ensure UI consistency if error occurs mid-process
      setNodes([]);
      setSenders([]);
      setReceivers([]);
      setNotification('');
    }
    setIsLoading(false);
  };

  const handleDiscover = () => {
    fetchResources(false, registryUrl); // isRefresh is not strictly needed now but kept for consistency
  };

  const handleConnect = async (senderId, receiverId) => {
    console.log(`Attempting to connect sender ${senderId} to receiver ${receiverId}`);
    if (!senderId || !receiverId) {
      alert('请选择发送端和接收端。');
      return;
    }
    setNotification(`正在尝试将发送端 ${senderId} 连接到接收端 ${receiverId}...`);

    try {
      const response = await fetch('/api/is05/connections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ senderId, receiverId }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message || `连接失败，状态：${response.status}`);
      }
      setNotification(`成功将发送端 ${senderId} 连接到接收端 ${receiverId}。接收端响应：${JSON.stringify(result.receiverResponse, null, 2)}`);
      setActiveRoutes(prev => ({ ...prev, [senderId]: { receiverId } }));
      setHighlight(receiverId);
      setTimeout(() => setHighlight(''), 1000); // Highlight for 1 second
    } catch (e) {
      console.error("连接失败：", e);
      setError(`连接错误：${e.message}`);
      setNotification('');
    }
  };

  const handleSubscriptionUpdate = (topic, changes) => {
    console.log('Subscription update:', topic, changes);
    // Future: Implement logic to update nodes/devices/senders/receivers based on WebSocket messages
    // This might involve re-fetching or intelligently merging changes.
    // For now, a simple re-fetch on significant updates might be an option,
    // or more granular updates if the backend provides detailed change info.
  };

  return (
    <div className="App-container">
      <header className="App-header">
        <h1>Vega-NMOS控制面板</h1>
        <div className="registry-control">
          <label htmlFor="registryUrl">NMOS注册表URL：</label>
          <input
            type="text"
            id="registryUrl"
            value={registryUrl}
            onChange={(e) => setRegistryUrl(e.target.value)}
            placeholder="例如：http://your-registry.com/x-nmos/query/v1.3"
            className="registry-input"
          />
          <button
            onClick={handleDiscover}
            disabled={isLoading || !registryUrl}
            className="action-button discover-button"
          >
            {isLoading ? '正在发现...' : '发现/刷新资源'}
          </button>
          <button
            onClick={handleStopConnection}
            disabled={isLoading}
            className="action-button stop-button"
          >
            停止连接注册表
          </button>
        </div>
        <NmosSubscription onUpdate={handleSubscriptionUpdate} />
      </header>

      {error && <p className="message error"><FontAwesomeIcon icon={faExclamationTriangle} /> {error}</p>}
      {notification && <div className="notification">{notification}</div>}
      {isLoading && !error && <p className="message loading">正在加载资源...</p>}

      <div className="tabs">
        <button
          className={activeTab === 'routing' ? 'active' : ''}
          onClick={() => setActiveTab('routing')}
        >
          Routing
        </button>
        <button
          className={activeTab === 'rules' ? 'active' : ''}
          onClick={() => setActiveTab('rules')}
        >
          Event Rules (IS-07)
        </button>
        <button
          className={activeTab === 'mapping' ? 'active' : ''}
          onClick={() => setActiveTab('mapping')}
        >
          Channel Mapping (IS-08)
        </button>
      </div>

      {activeTab === 'routing' && (
        <div className="nodes-container">
          {nodes.length === 0 && !isLoading && !error && (
            <p className="empty-state-message">
              {registryUrl ? '未发现节点。请确保注册表URL正确且可访问。' : '请输入注册表URL并点击发现资源。'}
            </p>
          )}
          {nodes.map(node => (
            <NodeDisplay
              key={node.id}
              node={node}
              allReceivers={receivers}
              handleConnect={handleConnect}
              activeRoutes={activeRoutes}
              highlight={highlight}
            />
          ))}
        </div>
      )}

      {activeTab === 'rules' && <EventRules senders={senders} receivers={receivers} />}

      {activeTab === 'mapping' && <ChannelMapping nodes={nodes} />}
    </div>
  );
}

export default App;
