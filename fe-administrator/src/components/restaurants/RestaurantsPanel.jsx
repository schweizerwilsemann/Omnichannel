import { useState, useEffect } from "react";
import {
  Alert,
  Badge,
  Button,
  Card,
  Col,
  Form,
  Row,
  Spinner,
  Table,
  Pagination,
  Modal,
} from "react-bootstrap";
import { toast } from "react-toastify";
import {
  fetchRestaurants,
  createRestaurant,
  updateRestaurant,
  deleteRestaurant,
  updateRestaurantStatus,
} from "../../services/restaurant.service.js";

const DEFAULT_PAGE_SIZE = 10;

const initialRestaurantForm = {
  ownerId: "",
  name: "",
  address: {
    street: "",
    city: "",
    state: "",
    zipCode: "",
    country: "",
  },
  businessHours: {
    monday: { open: "09:00", close: "22:00", isOpen: true },
    tuesday: { open: "09:00", close: "22:00", isOpen: true },
    wednesday: { open: "09:00", close: "22:00", isOpen: true },
    thursday: { open: "09:00", close: "22:00", isOpen: true },
    friday: { open: "09:00", close: "22:00", isOpen: true },
    saturday: { open: "10:00", close: "23:00", isOpen: true },
    sunday: { open: "10:00", close: "21:00", isOpen: true },
  },
  timezone: "UTC",
  status: "ACTIVE",
};

const RestaurantsPanel = () => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState({});
  const [updating, setUpdating] = useState({});
  const [restaurants, setRestaurants] = useState([]);
  const [owners, setOwners] = useState([]);
  const [restaurantForm, setRestaurantForm] = useState(initialRestaurantForm);
  const [editingRestaurant, setEditingRestaurant] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: DEFAULT_PAGE_SIZE,
    totalItems: 0,
    totalPages: 0,
    hasNext: false,
    hasPrevious: false,
  });

  const loadRestaurants = async (overrides = {}) => {
    const nextPage = overrides.page ?? pagination.page;
    const nextPageSize = overrides.pageSize ?? pagination.pageSize;

    setLoading(true);
    try {
      const response = await fetchRestaurants({
        page: nextPage,
        pageSize: nextPageSize,
      });
      const payload = response.data?.data || {};

      setRestaurants(payload.restaurants || []);

      // Extract unique owners from restaurants
      const uniqueOwners = new Map();
      payload.restaurants?.forEach((restaurant) => {
        if (restaurant.owner) {
          uniqueOwners.set(restaurant.owner.id, restaurant.owner);
        }
      });
      setOwners(Array.from(uniqueOwners.values()));

      setPagination({
        page: payload.page || nextPage,
        pageSize: payload.pageSize || nextPageSize,
        totalItems: payload.totalItems || 0,
        totalPages: payload.totalPages || 0,
        hasNext: payload.hasNext || false,
        hasPrevious: payload.hasPrevious || false,
      });
    } catch (error) {
      toast.error(
        error.response?.data?.message || "Unable to load restaurants"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRestaurants();
  }, []);

  const handleFormChange = (event) => {
    const { name, value, type, checked } = event.target;

    if (name.startsWith("address.")) {
      const addressField = name.split(".")[1];
      setRestaurantForm((prev) => ({
        ...prev,
        address: {
          ...prev.address,
          [addressField]: value,
        },
      }));
    } else if (name.startsWith("businessHours.")) {
      const [, day, field] = name.split(".");
      setRestaurantForm((prev) => ({
        ...prev,
        businessHours: {
          ...prev.businessHours,
          [day]: {
            ...prev.businessHours[day],
            [field]: type === "checkbox" ? checked : value,
          },
        },
      }));
    } else {
      setRestaurantForm((prev) => ({
        ...prev,
        [name]: type === "checkbox" ? checked : value,
      }));
    }
  };

  const handleCreateRestaurant = async (event) => {
    event.preventDefault();
    if (saving) return;

    if (!restaurantForm.ownerId || !restaurantForm.name.trim()) {
      toast.warning("Please select an owner and enter a restaurant name");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ownerId: restaurantForm.ownerId,
        name: restaurantForm.name.trim(),
        address: restaurantForm.address,
        businessHours: restaurantForm.businessHours,
        timezone: restaurantForm.timezone,
        status: restaurantForm.status,
      };

      const response = await createRestaurant(payload);
      const created = response.data?.data;

      if (created) {
        toast.success("Restaurant created successfully");
        setRestaurantForm(initialRestaurantForm);
        setShowModal(false);
        await loadRestaurants({ page: 1 });
      }
    } catch (error) {
      toast.error(
        error.response?.data?.message || "Unable to create restaurant"
      );
    } finally {
      setSaving(false);
    }
  };

  const handleEditRestaurant = (restaurant) => {
    setEditingRestaurant(restaurant.id);
    setRestaurantForm({
      ownerId: restaurant.ownerId || restaurant.owner?.id || "",
      name: restaurant.name || "",
      address: restaurant.address || initialRestaurantForm.address,
      businessHours: restaurant.businessHours || initialRestaurantForm.businessHours,
      timezone: restaurant.timezone || "UTC",
      status: restaurant.status || "ACTIVE",
    });
    setShowModal(true);
  };

  const handleUpdateRestaurant = async (event) => {
    event.preventDefault();
    if (saving || !editingRestaurant) return;

    if (!restaurantForm.name.trim()) {
      toast.warning("Please enter a restaurant name");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: restaurantForm.name.trim(),
        address: restaurantForm.address,
        businessHours: restaurantForm.businessHours,
        timezone: restaurantForm.timezone,
        status: restaurantForm.status,
      };

      const response = await updateRestaurant(editingRestaurant, payload);
      const updated = response.data?.data;

      if (updated) {
        toast.success("Restaurant updated successfully");
        setEditingRestaurant(null);
        setRestaurantForm(initialRestaurantForm);
        setShowModal(false);
        await loadRestaurants();
      }
    } catch (error) {
      toast.error(
        error.response?.data?.message || "Unable to update restaurant"
      );
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setEditingRestaurant(null);
    setRestaurantForm(initialRestaurantForm);
    setShowModal(false);
  };

  const handleDeleteRestaurant = async (restaurantId) => {
    if (deleting[restaurantId]) return;

    const confirmed = window.confirm(
      "Are you sure you want to delete this restaurant? This action cannot be undone and will affect all related data."
    );
    if (!confirmed) return;

    setDeleting((prev) => ({ ...prev, [restaurantId]: true }));
    try {
      await deleteRestaurant(restaurantId);
      toast.success("Restaurant deleted successfully");
      await loadRestaurants();
    } catch (error) {
      toast.error(
        error.response?.data?.message || "Unable to delete restaurant"
      );
    } finally {
      setDeleting((prev) => {
        const next = { ...prev };
        delete next[restaurantId];
        return next;
      });
    }
  };

  const handleStatusChange = async (restaurantId, newStatus) => {
    if (updating[restaurantId]) return;

    setUpdating((prev) => ({ ...prev, [restaurantId]: true }));
    try {
      const response = await updateRestaurantStatus(restaurantId, { status: newStatus });
      const updated = response.data?.data;

      if (updated) {
        setRestaurants((prev) =>
          prev.map((restaurant) =>
            restaurant.id === restaurantId ? { ...restaurant, status: newStatus } : restaurant
          )
        );
        toast.success("Restaurant status updated successfully");
      }
    } catch (error) {
      toast.error(
        error.response?.data?.message || "Unable to update restaurant status"
      );
    } finally {
      setUpdating((prev) => {
        const next = { ...prev };
        delete next[restaurantId];
        return next;
      });
    }
  };

  const handlePageChange = (nextPage) => {
    const target = Math.max(1, nextPage);
    if (target === pagination.page || loading) return;
    loadRestaurants({ page: target });
  };

  const formatAddress = (address) => {
    if (!address) return "N/A";
    const parts = [
      address.street,
      address.city,
      address.state,
      address.zipCode,
      address.country
    ].filter(Boolean);
    return parts.length > 0 ? parts.join(", ") : "N/A";
  };

  const formatBusinessHours = (businessHours) => {
    if (!businessHours) return "N/A";
    const openDays = Object.entries(businessHours)
      .filter(([, hours]) => hours.isOpen)
      .map(([day, hours]) => `${day.charAt(0).toUpperCase() + day.slice(1)}: ${hours.open}-${hours.close}`)
      .join(", ");
    return openDays || "Closed";
  };

  const describeRange = (pagination, currentCount) => {
    if (!pagination || pagination.totalItems === 0 || currentCount === 0) {
      return "No records";
    }
    const start = (pagination.page - 1) * pagination.pageSize + 1;
    const end = Math.min(start + currentCount - 1, pagination.totalItems);
    return `Showing ${start}-${end} of ${pagination.totalItems}`;
  };

  const statusVariants = {
    ACTIVE: "success",
    INACTIVE: "secondary",
    SUSPENDED: "warning",
  };

  return (
    <div className="d-flex flex-column gap-4">
      <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
        <h5 className="mb-0">Restaurants</h5>
        <div className="d-flex gap-2">
          <Button
            variant="outline-secondary"
            size="sm"
            onClick={() => loadRestaurants()}
            disabled={loading}
          >
            {loading ? "Refreshing…" : "Refresh"}
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              setEditingRestaurant(null);
              setRestaurantForm(initialRestaurantForm);
              setShowModal(true);
            }}
          >
            Create Restaurant
          </Button>
        </div>
      </div>

      <Card className="shadow-sm">
        <Card.Body className="d-flex flex-column gap-3">
          <div className="d-flex justify-content-between align-items-center">
            <h6 className="mb-0">Restaurant Directory</h6>
            <div className="text-muted small">{restaurants.length} restaurants</div>
          </div>

          {loading && restaurants.length === 0 ? (
            <div className="d-flex justify-content-center py-4">
              <Spinner animation="border" role="status" />
            </div>
          ) : null}

          {!loading && restaurants.length === 0 ? (
            <Alert variant="light" className="mb-0">
              No restaurants found. Create your first restaurant using the button above.
            </Alert>
          ) : null}

          {restaurants.length > 0 ? (
            <>
              <div className="table-responsive">
                <Table hover size="sm" className="mb-0">
                  <thead>
                    <tr>
                      <th style={{ width: "20%" }}>Name</th>
                      <th style={{ width: "15%" }}>Owner</th>
                      <th style={{ width: "25%" }}>Address</th>
                      <th style={{ width: "10%" }} className="text-center">
                        Status
                      </th>
                      <th style={{ width: "10%" }}>Timezone</th>
                      <th style={{ width: "20%" }} className="text-end">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {restaurants.map((restaurant) => (
                      <tr key={restaurant.id}>
                        <td className="fw-semibold">{restaurant.name}</td>
                        <td>
                          <div className="small">
                            <div>{restaurant.owner ? `${restaurant.owner.firstName} ${restaurant.owner.lastName}` : "N/A"}</div>
                            <div className="text-muted">{restaurant.owner?.email}</div>
                          </div>
                        </td>
                        <td className="small text-muted">
                          {formatAddress(restaurant.address)}
                        </td>
                        <td className="text-center">
                          <Form.Select
                            size="sm"
                            value={restaurant.status}
                            onChange={(e) => handleStatusChange(restaurant.id, e.target.value)}
                            disabled={updating[restaurant.id]}
                            style={{ minWidth: "100px" }}
                          >
                            <option value="ACTIVE">Active</option>
                            <option value="INACTIVE">Inactive</option>
                            <option value="SUSPENDED">Suspended</option>
                          </Form.Select>
                        </td>
                        <td className="small">{restaurant.timezone}</td>
                        <td className="text-end">
                          <div className="d-flex gap-1 justify-content-end">
                            <Button
                              variant="outline-primary"
                              size="sm"
                              onClick={() => handleEditRestaurant(restaurant)}
                              disabled={saving || updating[restaurant.id]}
                            >
                              Edit
                            </Button>
                            <Button
                              variant="outline-danger"
                              size="sm"
                              onClick={() => handleDeleteRestaurant(restaurant.id)}
                              disabled={deleting[restaurant.id] || saving || updating[restaurant.id]}
                            >
                              {deleting[restaurant.id] ? (
                                <Spinner animation="border" size="sm" />
                              ) : (
                                "Delete"
                              )}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>

              <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 pt-3">
                <div className="text-muted small">
                  {describeRange(pagination, restaurants.length)}
                </div>
                {pagination.totalPages > 1 ? (
                  <Pagination className="mb-0">
                    <Pagination.Prev
                      disabled={!pagination.hasPrevious || loading}
                      onClick={() => handlePageChange(pagination.page - 1)}
                    />
                    <Pagination.Item active>{pagination.page}</Pagination.Item>
                    <Pagination.Next
                      disabled={!pagination.hasNext || loading}
                      onClick={() => handlePageChange(pagination.page + 1)}
                    />
                  </Pagination>
                ) : null}
              </div>
            </>
          ) : null}
        </Card.Body>
      </Card>

      {/* Restaurant Form Modal */}
      <Modal show={showModal} onHide={handleCancelEdit} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>
            {editingRestaurant ? "Edit Restaurant" : "Create New Restaurant"}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form
            onSubmit={editingRestaurant ? handleUpdateRestaurant : handleCreateRestaurant}
            className="d-flex flex-column gap-3"
          >
            <Row className="g-3">
              <Col md={8}>
                <Form.Group controlId="restaurant-name">
                  <Form.Label>Restaurant Name</Form.Label>
                  <Form.Control
                    name="name"
                    value={restaurantForm.name}
                    onChange={handleFormChange}
                    placeholder="e.g. Joe's Pizza Palace"
                    required
                    disabled={saving}
                  />
                </Form.Group>
              </Col>
              <Col md={4}>
                <Form.Group controlId="restaurant-owner">
                  <Form.Label>Owner</Form.Label>
                  <Form.Select
                    name="ownerId"
                    value={restaurantForm.ownerId}
                    onChange={handleFormChange}
                    required
                    disabled={editingRestaurant !== null || owners.length === 0 || saving}
                  >
                    <option value="">Select owner</option>
                    {owners.map((owner) => (
                      <option key={owner.id} value={owner.id}>
                        {owner.firstName} {owner.lastName} ({owner.email})
                      </option>
                    ))}
                  </Form.Select>
                </Form.Group>
              </Col>
            </Row>

            <div className="border-top pt-3">
              <h6>Address Information</h6>
              <Row className="g-3">
                <Col md={12}>
                  <Form.Group controlId="restaurant-address-street">
                    <Form.Label>Street Address</Form.Label>
                    <Form.Control
                      name="address.street"
                      value={restaurantForm.address.street}
                      onChange={handleFormChange}
                      placeholder="123 Main Street"
                      disabled={saving}
                    />
                  </Form.Group>
                </Col>
                <Col md={4}>
                  <Form.Group controlId="restaurant-address-city">
                    <Form.Label>City</Form.Label>
                    <Form.Control
                      name="address.city"
                      value={restaurantForm.address.city}
                      onChange={handleFormChange}
                      placeholder="New York"
                      disabled={saving}
                    />
                  </Form.Group>
                </Col>
                <Col md={3}>
                  <Form.Group controlId="restaurant-address-state">
                    <Form.Label>State/Province</Form.Label>
                    <Form.Control
                      name="address.state"
                      value={restaurantForm.address.state}
                      onChange={handleFormChange}
                      placeholder="NY"
                      disabled={saving}
                    />
                  </Form.Group>
                </Col>
                <Col md={3}>
                  <Form.Group controlId="restaurant-address-zip">
                    <Form.Label>ZIP/Postal Code</Form.Label>
                    <Form.Control
                      name="address.zipCode"
                      value={restaurantForm.address.zipCode}
                      onChange={handleFormChange}
                      placeholder="10001"
                      disabled={saving}
                    />
                  </Form.Group>
                </Col>
                <Col md={2}>
                  <Form.Group controlId="restaurant-address-country">
                    <Form.Label>Country</Form.Label>
                    <Form.Control
                      name="address.country"
                      value={restaurantForm.address.country}
                      onChange={handleFormChange}
                      placeholder="USA"
                      disabled={saving}
                    />
                  </Form.Group>
                </Col>
              </Row>
            </div>

            <Row className="g-3">
              <Col md={6}>
                <Form.Group controlId="restaurant-timezone">
                  <Form.Label>Timezone</Form.Label>
                  <Form.Select
                    name="timezone"
                    value={restaurantForm.timezone}
                    onChange={handleFormChange}
                    disabled={saving}
                  >
                    <option value="UTC">UTC</option>
                    <option value="America/New_York">Eastern Time</option>
                    <option value="America/Chicago">Central Time</option>
                    <option value="America/Denver">Mountain Time</option>
                    <option value="America/Los_Angeles">Pacific Time</option>
                  </Form.Select>
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group controlId="restaurant-status">
                  <Form.Label>Status</Form.Label>
                  <Form.Select
                    name="status"
                    value={restaurantForm.status}
                    onChange={handleFormChange}
                    disabled={saving}
                  >
                    <option value="ACTIVE">Active</option>
                    <option value="INACTIVE">Inactive</option>
                    <option value="SUSPENDED">Suspended</option>
                  </Form.Select>
                </Form.Group>
              </Col>
            </Row>

            <div className="border-top pt-3">
              <h6>Business Hours</h6>
              {Object.entries(restaurantForm.businessHours).map(([day, hours]) => (
                <Row key={day} className="g-2 align-items-center mb-2">
                  <Col md={2}>
                    <Form.Check
                      type="switch"
                      id={`${day}-open`}
                      name={`businessHours.${day}.isOpen`}
                      label={day.charAt(0).toUpperCase() + day.slice(1)}
                      checked={hours.isOpen}
                      onChange={handleFormChange}
                      disabled={saving}
                    />
                  </Col>
                  <Col md={3}>
                    <Form.Control
                      type="time"
                      name={`businessHours.${day}.open`}
                      value={hours.open}
                      onChange={handleFormChange}
                      disabled={saving || !hours.isOpen}
                    />
                  </Col>
                  <Col md={1} className="text-center">
                    <span className="text-muted">to</span>
                  </Col>
                  <Col md={3}>
                    <Form.Control
                      type="time"
                      name={`businessHours.${day}.close`}
                      value={hours.close}
                      onChange={handleFormChange}
                      disabled={saving || !hours.isOpen}
                    />
                  </Col>
                </Row>
              ))}
            </div>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={handleCancelEdit} disabled={saving}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={editingRestaurant ? handleUpdateRestaurant : handleCreateRestaurant}
            disabled={saving || (editingRestaurant === null && owners.length === 0)}
          >
            {saving ? (
              <>
                <Spinner animation="border" size="sm" className="me-2" />
                {editingRestaurant ? "Updating…" : "Creating…"}
              </>
            ) : editingRestaurant ? (
              "Update Restaurant"
            ) : (
              "Create Restaurant"
            )}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default RestaurantsPanel;
