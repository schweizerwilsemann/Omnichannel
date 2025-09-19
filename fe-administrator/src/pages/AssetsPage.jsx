import { useEffect, useMemo, useRef, useState } from 'react';
import { Card, Button, Form, Table, Spinner, Row, Col, Badge } from 'react-bootstrap';
import { toast } from 'react-toastify';
import MainLayout from '../components/layout/MainLayout.jsx';
import appConfig from '../config/appConfig.js';
import { deleteAsset, listAssets, uploadAsset } from '../services/asset.service.js';

const resolveUrl = (url) => {
    if (!url) {
        return '';
    }

    if (/^https?:\/\//i.test(url)) {
        return url;
    }

    const base = appConfig.baseUrl.replace(/\/$/, '');
    const path = url.startsWith('/') ? url : `/${url}`;
    return `${base}${path}`;
};

const formatBytes = (bytes) => {
    if (!Number.isFinite(bytes) || bytes <= 0) {
        return '0 B';
    }

    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    const value = bytes / Math.pow(1024, index);
    return `${value.toFixed(value < 10 && index > 0 ? 1 : 0)} ${units[index]}`;
};

const AssetsPage = () => {
    const [assets, setAssets] = useState([]);
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [selectedFile, setSelectedFile] = useState(null);
    const [previewUrl, setPreviewUrl] = useState('');
    const inputRef = useRef(null);

    useEffect(() => {
        const fetchAssets = async () => {
            try {
                setLoading(true);
                const response = await listAssets();
                setAssets(response.data?.data || []);
            } catch (error) {
                toast.error('Could not load assets.');
            } finally {
                setLoading(false);
            }
        };

        fetchAssets();
    }, []);

    useEffect(() => () => {
        if (previewUrl) {
            URL.revokeObjectURL(previewUrl);
        }
    }, [previewUrl]);

    const handleFileChange = (event) => {
        const file = event.target.files?.[0];
        if (!file) {
            setSelectedFile(null);
            setPreviewUrl('');
            return;
        }

        if (previewUrl) {
            URL.revokeObjectURL(previewUrl);
        }

        const nextPreview = file.type.startsWith('image/') ? URL.createObjectURL(file) : '';
        setSelectedFile(file);
        setPreviewUrl(nextPreview);
    };

    const handleUpload = async (event) => {
        event.preventDefault();
        if (!selectedFile) {
            toast.warning('Please choose a file to upload.');
            return;
        }

        try {
            setUploading(true);
            const response = await uploadAsset(selectedFile);
            const uploadedAsset = response.data?.data;
            if (uploadedAsset) {
                setAssets((prev) => [uploadedAsset, ...prev]);
                toast.success('Asset uploaded successfully.');
            } else {
                toast.info('Upload finished but no metadata returned.');
            }
            setSelectedFile(null);
            if (previewUrl) {
                URL.revokeObjectURL(previewUrl);
                setPreviewUrl('');
            }
            if (inputRef.current) {
                inputRef.current.value = '';
            }
        } catch (error) {
            toast.error('Failed to upload asset.');
        } finally {
            setUploading(false);
        }
    };

    const handleDelete = async (asset) => {
        const confirmed = window.confirm(`Delete "${asset.fileName}"?`);
        if (!confirmed) {
            return;
        }

        try {
            await deleteAsset(asset.fileName);
            setAssets((prev) => prev.filter((item) => item.fileName !== asset.fileName));
            toast.success('Asset deleted.');
        } catch (error) {
            toast.error('Failed to delete asset.');
        }
    };

    const hasImagePreview = useMemo(() => Boolean(previewUrl), [previewUrl]);

    return (
        <MainLayout>
            <div className="d-flex flex-column gap-4">
                <div className="d-flex align-items-center justify-content-between">
                    <div>
                        <h2 className="mb-1">Asset Library</h2>
                        <p className="text-muted mb-0">Upload and manage photos or documents used across the platform.</p>
                    </div>
                    <Badge bg="secondary">{assets.length} files</Badge>
                </div>

                <Card className="shadow-sm">
                    <Card.Body>
                        <Form onSubmit={handleUpload} className="d-flex flex-column gap-3">
                            <Row className="align-items-end g-3">
                                <Col md={6}>
                                    <Form.Group controlId="asset-file">
                                        <Form.Label>Select file</Form.Label>
                                        <Form.Control
                                            type="file"
                                            accept="image/*,application/pdf"
                                            onChange={handleFileChange}
                                            ref={inputRef}
                                        />
                                    </Form.Group>
                                </Col>
                                <Col md={3}>
                                    <Button type="submit" disabled={uploading} className="w-100">
                                        {uploading ? (
                                            <>
                                                <Spinner size="sm" animation="border" className="me-2" /> Uploading...
                                            </>
                                        ) : (
                                            'Upload'
                                        )}
                                    </Button>
                                </Col>
                            </Row>

                            {hasImagePreview && (
                                <Row>
                                    <Col md={6} lg={4}>
                                        <div className="border rounded p-3 bg-light d-flex flex-column align-items-center">
                                            <span className="mb-2 fw-semibold">Preview</span>
                                            <img src={previewUrl} alt="File preview" className="img-fluid rounded" />
                                        </div>
                                    </Col>
                                </Row>
                            )}
                        </Form>
                    </Card.Body>
                </Card>

                <Card className="shadow-sm">
                    <Card.Body>
                        <div className="d-flex align-items-center justify-content-between mb-3">
                            <h5 className="mb-0">Uploaded assets</h5>
                            <Button variant="outline-secondary" size="sm" onClick={async () => {
                                try {
                                    setLoading(true);
                                    const response = await listAssets();
                                    setAssets(response.data?.data || []);
                                    toast.success('Asset list refreshed.');
                                } catch (error) {
                                    toast.error('Unable to refresh assets.');
                                } finally {
                                    setLoading(false);
                                }
                            }}>
                                Refresh
                            </Button>
                        </div>
                        {loading ? (
                            <div className="d-flex justify-content-center py-5">
                                <Spinner animation="border" />
                            </div>
                        ) : assets.length === 0 ? (
                            <p className="text-muted mb-0">No assets uploaded yet. Upload your first file above.</p>
                        ) : (
                            <div className="table-responsive">
                                <Table hover className="align-middle">
                                    <thead>
                                        <tr>
                                            <th>Name</th>
                                            <th className="text-nowrap">Size</th>
                                            <th className="text-nowrap">Last Modified</th>
                                            <th className="text-center">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {assets.map((asset) => {
                                            const assetUrl = resolveUrl(asset.downloadUrl);
                                            return (
                                                <tr key={asset.fileName}>
                                                    <td>
                                                        <div className="d-flex flex-column">
                                                            <span className="fw-semibold">{asset.fileName}</span>
                                                            {assetUrl && (
                                                                <Button
                                                                    variant="link"
                                                                    size="sm"
                                                                    className="px-0 text-decoration-none"
                                                                    onClick={() => window.open(assetUrl, '_blank', 'noopener,noreferrer')}
                                                                >
                                                                    View
                                                                </Button>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td>{formatBytes(asset.size)}</td>
                                                    <td>{asset.lastModified ? new Date(asset.lastModified).toLocaleString() : 'N/A'}</td>
                                                    <td className="text-center">
                                                        <div className="d-flex justify-content-center gap-2">
                                                            <Button
                                                                variant="outline-primary"
                                                                size="sm"
                                                                onClick={() => window.open(assetUrl, '_blank', 'noopener,noreferrer')}
                                                                disabled={!assetUrl}
                                                            >
                                                                Download
                                                            </Button>
                                                            <Button
                                                                variant="outline-danger"
                                                                size="sm"
                                                                onClick={() => handleDelete(asset)}
                                                            >
                                                                Delete
                                                            </Button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </Table>
                            </div>
                        )}
                    </Card.Body>
                </Card>
            </div>
        </MainLayout>
    );
};

export default AssetsPage;
