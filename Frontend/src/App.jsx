import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css';

const API_URL = 'http://localhost:5000';

function App() {
  const [districts, setDistricts] = useState([]);
  const [taluks, setTaluks] = useState([]);
  const [selectedDistrict, setSelectedDistrict] = useState('');
  const [selectedTaluk, setSelectedTaluk] = useState('');
  const [loading, setLoading] = useState(false);
  const [tableData, setTableData] = useState(null);
  const [detailUrls, setDetailUrls] = useState([]);
  const [error, setError] = useState(null);
  const [loadingTaluks, setLoadingTaluks] = useState(false);
  
  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [selectedProject, setSelectedProject] = useState(null);
  const [projectDetails, setProjectDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  useEffect(() => {
    fetchDistricts();
  }, []);

  const fetchDistricts = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/districts`);
      setDistricts(res.data.districts);
      if (res.data.districts.includes('Bengaluru Urban')) setSelectedDistrict('Bengaluru Urban');
    } catch (err) { setError('Failed to load districts'); }
  };

  useEffect(() => {
    if (selectedDistrict) fetchTaluks();
  }, [selectedDistrict]);

  const fetchTaluks = async () => {
    setLoadingTaluks(true);
    setSelectedTaluk('');
    setTaluks([]);
    setTableData(null);
    try {
      const res = await axios.post(`${API_URL}/api/taluks`, { district: selectedDistrict });
      setTaluks(res.data.taluks);
      if (res.data.taluks.length) setSelectedTaluk(res.data.taluks[0].value);
    } catch (err) { setError('Failed to load taluks'); }
    finally { setLoadingTaluks(false); }
  };

  const fetchProjects = async () => {
    if (!selectedDistrict || !selectedTaluk) return;
    setLoading(true);
    setError(null);
    setTableData(null);
    try {
      const res = await axios.post(`${API_URL}/api/scrape`, { district: selectedDistrict, taluk: selectedTaluk });
      if (res.data.success) {
        setTableData({ columns: res.data.columns, rows: res.data.data, totalCount: res.data.totalCount });
        setDetailUrls(res.data.detailUrls || []);
      } else setError('No data found');
    } catch (err) { setError(err.response?.data?.error || 'Failed to fetch projects'); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    if (selectedDistrict && selectedTaluk && !loading && !loadingTaluks) {
      const timer = setTimeout(() => fetchProjects(), 500);
      return () => clearTimeout(timer);
    }
  }, [selectedDistrict, selectedTaluk]);

  const handleViewDetails = async (index) => {
    const detailUrl = detailUrls[index];
    if (!detailUrl) {
      setError('No detail URL available for this project');
      return;
    }
    setLoadingDetails(true);
    setProjectDetails(null);
    setSelectedProject(tableData.rows[index]);
    setShowModal(true);
    try {
      const res = await axios.post(`${API_URL}/api/project-details`, { detailUrl });
      if (res.data.success) setProjectDetails(res.data.details);
      else setError('Could not fetch project details');
    } catch (err) {
      setError('Failed to load details: ' + err.message);
    } finally {
      setLoadingDetails(false);
    }
  };

  return (
    <div className="app">
      <header className="header">
        <h1>Karnataka RERA Project Details</h1>
        <p>Automated data extraction from rera.karnataka.gov.in</p>
      </header>

      <div className="filters">
        <div className="filter-group">
          <label>District:</label>
          <select value={selectedDistrict} onChange={(e) => setSelectedDistrict(e.target.value)} className="filter-select">
            <option value="">Select District</option>
            {districts.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
        <div className="filter-group">
          <label>Taluk:</label>
          <select value={selectedTaluk} onChange={(e) => setSelectedTaluk(e.target.value)} className="filter-select" disabled={loadingTaluks || taluks.length===0}>
            <option value="">Select Taluk</option>
            {taluks.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <button onClick={fetchProjects} className="search-btn" disabled={loading}>Fetch Projects</button>
      </div>

      {error && <div className="error-message">{error}</div>}
      {loading && <div className="loading-container"><div className="spinner"></div><p>Scraping data...</p></div>}

      {tableData && (
        <div className="results">
          <div className="results-header"><h2>Project Applications</h2><p>Total: {tableData.totalCount}</p></div>
          <div className="table-container">
            <table className="data-table">
              <thead><tr>{tableData.columns.map((col,i) => <th key={i}>{col}</th>)}<th>Actions</th></tr></thead>
              <tbody>
                {tableData.rows.map((row, idx) => (
                  <tr key={idx}>
                    {row.map((cell, ci) => <td key={ci}>{cell || '-'}</td>)}
                    <td><button onClick={() => handleViewDetails(idx)} className="detail-btn">View Details</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal for Project Details */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <span className="modal-close" onClick={() => setShowModal(false)}>&times;</span>
            {loadingDetails && <div className="loading-container"><div className="spinner"></div><p>Loading details...</p></div>}
            {projectDetails && (
              <div className="details-container">
                <h3>{projectDetails.header.projectName || 'Project Details'}</h3>
                <p><strong>Acknowledgement No:</strong> {projectDetails.header.acknowledgementNo}</p>
                <p><strong>Registration No:</strong> {projectDetails.header.registrationNo}</p>
                <hr />
                <h4>Promoter</h4>
                <p><strong>Name:</strong> {projectDetails.promoter.name}</p>
                <p><strong>PAN:</strong> {projectDetails.promoter.pan}</p>
                <p><strong>Address:</strong> {projectDetails.promoter.address}</p>
                <h4>Project</h4>
                <p><strong>Type:</strong> {projectDetails.project.type}</p>
                <p><strong>Status:</strong> {projectDetails.project.status}</p>
                <p><strong>Start Date:</strong> {projectDetails.project.startDate}</p>
                <p><strong>Completion Date:</strong> {projectDetails.project.completionDate}</p>
                <p><strong>Total Cost:</strong> {projectDetails.project.totalCost}</p>
                <h4>Documents ({projectDetails.documents?.length})</h4>
                <ul>
                  {projectDetails.documents?.slice(0, 10).map((doc, i) => (
                    <li key={i}><a href={doc.url} target="_blank" rel="noopener noreferrer">{doc.name}</a></li>
                  ))}
                  {projectDetails.documents?.length > 10 && <li>... and more</li>}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default App;