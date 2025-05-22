import { useState, useEffect, useCallback, useMemo } from 'react'; // Added useMemo
import './App.css';
import NmosSubscription from './components/NmosSubscription.jsx';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSatelliteDish, faBroadcastTower, faLink, faExclamationTriangle } from '@fortawesome/free-solid-svg-icons';
import { Tooltip } from 'react-tooltip';

function App() {
  const [senders, setSenders] = useState([]);
  const [receivers, setReceivers] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [registryUrl, setRegistryUrl] = useState(''); // Default, user can change
  const [activeRoutes, setActiveRoutes] = useState({});
  const [notification, setNotification] = useState('');
  const [highlight, setHighlight] = useState('');

  // Pagination state (assuming this was added in a previous step as per problem context)
  const [currentSendersPage, setCurrentSendersPage] = useState(1);
  const [sendersPerPage] = useState(6); // Example value
  const [currentReceiversPage, setCurrentReceiversPage] = useState(1);
  const [receiversPerPage] = useState(6); // Example value

  // Memoized senders for pagination
  const currentSenders = useMemo(() => {
    const indexOfLastSender = currentSendersPage * sendersPerPage;
    const indexOfFirstSender = indexOfLastSender - sendersPerPage;
    return senders.slice(indexOfFirstSender, indexOfLastSender);
  }, [senders, currentSendersPage, sendersPerPage]);

  // Memoized receivers for pagination
  const currentReceivers = useMemo(() => {
    const indexOfLastReceiver = currentReceiversPage * receiversPerPage;
    const indexOfFirstReceiver = indexOfLastReceiver - receiversPerPage;
    return receivers.slice(indexOfFirstReceiver, indexOfLastReceiver);
  }, [receivers, currentReceiversPage, receiversPerPage]);
  
  // const filteredReceivers = receivers; // This was a temporary fix, now using currentReceivers

  const fetchResources = useCallback(async (isRefresh = false, customUrl = null) => {
    setIsLoading(true);
    setError(null);
    const urlToUse = customUrl || registryUrl;
    if (!urlToUse || (!urlToUse.startsWith('http://') && !urlToUse.startsWith('https://'))) {
      setError('无效的注册表URL。必须以http://或https://开头');
      setIsLoading(false);
      setSenders([]);
      setReceivers([]);
      setCurrentSendersPage(1); // Reset pagination
      setCurrentReceiversPage(1); // Reset pagination
      return;
    }

    try {
      const apiUrl = '/api/is04/discover';
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ registryUrl: urlToUse }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: `HTTP错误！状态：${response.status}` }));
        throw new Error(errorData.message || `HTTP错误！状态：${response.status}`);
      }
      const data = await response.json();
      const resources = data.data;

      // console.log structures were here for verification, removing them now.
      
      setSenders(resources.senders || []);
      setReceivers(resources.receivers || []);
      setCurrentSendersPage(1); // Reset pagination
      setCurrentReceiversPage(1); // Reset pagination
      alert(data.message || '资源获取成功！');
      setError(null);
    } catch (e) {
      console.error("获取IS-04资源失败：", e);
      setError(`加载资源失败：${e.message}。请确保后端正在运行且NMOS_REGISTRY_URL可被后端访问。`);
      setSenders([]);
      setReceivers([]);
      setCurrentSendersPage(1); // Reset pagination
      setCurrentReceiversPage(1); // Reset pagination
    }
    setIsLoading(false);
  }, [registryUrl, sendersPerPage, receiversPerPage]); // Added pagination setters to dependencies

  useEffect(() => {
    // if (registryUrl) fetchResources(false, registryUrl); // Keep manual trigger
  }, [registryUrl, fetchResources]);

  const handleStopConnection = async () => {
    setIsLoading(true);
    setError(null);
    setNotification('正在尝试停止与注册表的连接...');

    try {
      const response = await fetch('/api/nmos/stop-registry', {
        method: 'POST',
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || `停止连接失败，状态：${response.status}`);
      }

      setNotification(result.message || '成功停止与注册表的连接。');
      setSenders([]);
      setReceivers([]);
      setCurrentSendersPage(1); // Reset pagination
      setCurrentReceiversPage(1); // Reset pagination
    } catch (e) {
      console.error("停止连接失败：", e);
      setError(`停止连接错误：${e.message}`);
      setNotification(''); 
    }
    setIsLoading(false);
  };

  const handleDiscover = () => {
    fetchResources(true, registryUrl); 
  };

  const handleConnect = async (senderId, receiverId) => {
    console.log(`Attempting to connect sender ${senderId} to receiver ${receiverId}`); // Added log
    if (!senderId || !receiverId) {
      alert('请选择发送端和接收端。');
      return;
    }
    setNotification(`正在尝试将发送端${senderId}连接到接收端${receiverId}...`);

    try {
      const response = await fetch('/api/is05/connections', { // Modified URL
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ senderId, receiverId }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || `连接失败，状态：${response.status}`);
      }

      setNotification(`成功将发送端${senderId}连接到接收端${receiverId}。接收端响应：${JSON.stringify(result.receiverResponse, null, 2)}`);
      setActiveRoutes(prev => ({ ...prev, [senderId]: { receiverId } }));
      setHighlight(receiverId);
      setTimeout(() => setHighlight(''), 1000);
    } catch (e) {
      console.error("连接失败：", e);
      setError(`连接错误：${e.message}`);
      setNotification(''); 
    }
  };

  const handleSubscriptionUpdate = (topic, changes) => {
    // 处理订阅更新
    console.log('Subscription update:', topic, changes);
    // 这里可以添加更多逻辑来处理更新
  };

  // Pagination functions (assuming these were added in a previous step)
  const paginateSenders = (pageNumber) => setCurrentSendersPage(pageNumber);
  const paginateReceivers = (pageNumber) => setCurrentReceiversPage(pageNumber);

  // PaginationControls component (assuming this was added in a previous step)
  const PaginationControls = ({ currentPage, totalPages, paginate, type }) => {
    if (totalPages <= 1) return null;
    const pageNumbers = [];
    for (let i = 1; i <= totalPages; i++) pageNumbers.push(i);
    return (
      <div className="pagination-controls">
        <button onClick={() => paginate(currentPage - 1)} disabled={currentPage === 1}>上一页</button>
        {pageNumbers.map(number => (
          <button key={`${type}-${number}`} onClick={() => paginate(number)} className={currentPage === number ? 'active' : ''}>{number}</button>
        ))}
        <button onClick={() => paginate(currentPage + 1)} disabled={currentPage === totalPages}>下一页</button>
      </div>
    );
  };

  // Grouping Function
  const groupResourcesByDevice = (resourcesList) => { // Renamed 'resources' to 'resourcesList'
    if (!resourcesList) return {};
    return resourcesList.reduce((acc, resource) => {
      const deviceId = resource.device_id || 'unknown_device'; // Fallback for safety
      if (!acc[deviceId]) {
        acc[deviceId] = [];
      }
      acc[deviceId].push(resource);
      return acc;
    }, {});
  };

  // Apply Grouping to Paginated Data
  const groupedSenders = useMemo(() => groupResourcesByDevice(currentSenders), [currentSenders]);
  const groupedReceivers = useMemo(() => groupResourcesByDevice(currentReceivers), [currentReceivers]);


  return (
    <div className="App-container">
      <header className="App-header">
        <h1>Vega-NMOS控制面板</h1>
        <div className="registry-control">
          <label htmlFor="registryUrl">NMOS注册表URL（查询API v1.x）：</label>
          <input 
            type="text" 
            id="registryUrl" 
            value={registryUrl}
            onChange={(e) => setRegistryUrl(e.target.value)}
            placeholder="例如：http://0.11.1.14:8010/x-nmos/query/v1.3"
            className="registry-input"
          />
          <button onClick={handleDiscover} disabled={isLoading || !registryUrl} style={{ backgroundColor: '#007BFF', color: '#FFFFFF', border: 'none', padding: '10px 20px', borderRadius: '4px', cursor: 'pointer', fontSize: '1em', minHeight: '44px' }}>
            {isLoading ? '正在发现...' : '发现/刷新资源'}
          </button>
          <button onClick={handleStopConnection} disabled={isLoading} className="stop-button">停止连接注册表</button>
        </div>
        <NmosSubscription onUpdate={handleSubscriptionUpdate} />
      </header>
      {error && <p className="message error"><FontAwesomeIcon icon={faExclamationTriangle} /> {error}</p>}
      {notification && <div className="notification">{notification}</div>}
      {isLoading && !error && <p className="message loading">正在加载资源...</p>}
      <div className="resource-container">
        <div className="resource-section">
          <h2><FontAwesomeIcon icon={faBroadcastTower} /> 发送端 ({senders.length})</h2>
          {senders.length === 0 && !isLoading && <p>未发现发送端。</p>}
          {senders.length > 0 && Object.keys(groupedSenders).length === 0 && currentSenders.length > 0 && !isLoading && <p>当前页没有发送端。</p>}
          {senders.length > 0 && Object.keys(groupedSenders).length === 0 && currentSenders.length === 0 && !isLoading && <p>当前页没有发送端 (可能是由于翻页到了空页)。</p>}

          <div className="resource-grid">
            {Object.entries(groupedSenders).map(([deviceId, sendersInGroup]) => (
              <div key={deviceId} className="device-group">
                <h4 className="group-heading">Device: {deviceId}</h4>
                {sendersInGroup.map((sender) => (
                  <div key={sender.id} className="resource-card">
                    <h3><FontAwesomeIcon icon={faBroadcastTower} style={{ color: '#28a745' }} /> {sender.label || '未命名发送端'}</h3>
                    <div className="resource-details">
                      <p data-tooltip-id={`tooltip-sender-${sender.id}`}>ID: {sender.id}</p>
                      <Tooltip id={`tooltip-sender-${sender.id}`} place="top" content={`发送端ID: ${sender.id}`} />
                      <p>Flow ID: {sender.flow_id}</p>
                      <p>Transport: {sender.transport}</p>
                    </div>
                    {receivers.length > 0 && (
                      <div className="connection-control">
                        <select 
                          onChange={(e) => e.target.value && handleConnect(sender.id, e.target.value)} 
                          defaultValue=""
                          className="receiver-select"
                        >
                          <option value="" disabled>选择接收端进行连接...</option>
                          {receivers.map(receiver => (
                            <option key={receiver.id} value={receiver.id}>
                              {receiver.label || `接收端 ${receiver.id}`}
                            </option>
                          ))}
                        </select>
                        {/* Removed the direct connect button for clarity */}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>
          <PaginationControls 
            currentPage={currentSendersPage} 
            totalPages={Math.ceil(senders.length / sendersPerPage)} 
            paginate={paginateSenders}
            type="senders"
          />
        </div>

        <div className="resource-section">
          <h2><FontAwesomeIcon icon={faSatelliteDish} /> 接收端 ({receivers.length})</h2>
          {receivers.length === 0 && !isLoading && <p>未发现接收端。</p>}
          {receivers.length > 0 && Object.keys(groupedReceivers).length === 0 && currentReceivers.length > 0 && !isLoading && <p>当前页没有接收端。</p>}
          {receivers.length > 0 && Object.keys(groupedReceivers).length === 0 && currentReceivers.length === 0 && !isLoading && <p>当前页没有接收端 (可能是由于翻页到了空页)。</p>}
          
          <div className="resource-grid">
            {Object.entries(groupedReceivers).map(([deviceId, receiversInGroup]) => (
              <div key={deviceId} className="device-group">
                <h4 className="group-heading">Device: {deviceId}</h4>
                {receiversInGroup.map((receiver) => (
                  <div key={receiver.id} className={`resource-card ${Object.values(activeRoutes).some(route => route.receiverId === receiver.id) ? 'active-route' : ''} ${highlight === receiver.id ? 'highlight' : ''}`}>
                    <h3><FontAwesomeIcon icon={faSatelliteDish} style={{ color: Object.values(activeRoutes).some(route => route.receiverId === receiver.id) ? '#28a745' : '#dc3545' }} /> {receiver.label || '未命名接收端'}</h3>
                    <div className="resource-details">
                      <p data-tooltip-id={`tooltip-receiver-${receiver.id}`}>ID: {receiver.id}</p>
                      <Tooltip id={`tooltip-receiver-${receiver.id}`} place="top" content={`接收端ID: ${receiver.id}`} />
                      <p>Format: {receiver.format}</p>
                      <p>Capabilities: {JSON.stringify(receiver.caps, null, 2)}</p> {/* Corrected 'Caps' to 'Capabilities' for consistency if needed, or keep as 'Caps' if that's the actual data */}
                      {Object.values(activeRoutes).some(route => route.receiverId === receiver.id) && <p>活动路由来自: {Object.keys(activeRoutes).find(key => activeRoutes[key].receiverId === receiver.id)}</p>}
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
          <PaginationControls 
            currentPage={currentReceiversPage} 
            totalPages={Math.ceil(receivers.length / receiversPerPage)} 
            paginate={paginateReceivers}
            type="receivers"
          />
        </div>
      </div>
    </div>
  );
}

export default App;
