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
} from "react-bootstrap";
import { toast } from "react-toastify";
import {
  fetchMenuCategories,
  createMenuCategory,
  updateMenuCategory,
  deleteMenuCategory,
} from "../../services/management.service.js";

const DEFAULT_PAGE_SIZE = 10;

const initialCategoryForm = {
  restaurantId: "",
  name: "",
  sortOrder: "0",
  isActive: true,
};

const MenuCategoriesPanel = () => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState({});
  const [categories, setCategories] = useState([]);
  const [restaurants, setRestaurants] = useState([]);
  const [categoryForm, setCategoryForm] = useState(initialCategoryForm);
  const [editingCategory, setEditingCategory] = useState(null);
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: DEFAULT_PAGE_SIZE,
    totalItems: 0,
    totalPages: 0,
    hasNext: false,
    hasPrevious: false,
  });

  const loadCategories = async (overrides = {}) => {
    const nextPage = overrides.page ?? pagination.page;
    const nextPageSize = overrides.pageSize ?? pagination.pageSize;

    setLoading(true);
    try {
      const response = await fetchMenuCategories({
        page: nextPage,
        pageSize: nextPageSize,
      });
      const payload = response.data?.data || {};

      setCategories(payload.categories || []);

      // Extract unique restaurants from categories
      const uniqueRestaurants = new Map();
      payload.categories?.forEach((category) => {
        if (category.restaurant) {
          uniqueRestaurants.set(category.restaurant.id, category.restaurant);
        }
      });
      setRestaurants(Array.from(uniqueRestaurants.values()));

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
        error.response?.data?.message || "Unable to load menu categories"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCategories();
  }, []);

  const handleFormChange = (event) => {
    const { name, value, type, checked } = event.target;
    setCategoryForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleCreateCategory = async (event) => {
    event.preventDefault();
    if (saving) return;

    if (!categoryForm.restaurantId || !categoryForm.name.trim()) {
      toast.warning("Please select a restaurant and enter a category name");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        restaurantId: categoryForm.restaurantId,
        name: categoryForm.name.trim(),
        sortOrder: parseInt(categoryForm.sortOrder) || 0,
        isActive: categoryForm.isActive,
      };

      const response = await createMenuCategory(payload);
      const created = response.data?.data;

      if (created) {
        toast.success("Menu category created successfully");
        setCategoryForm(initialCategoryForm);
        await loadCategories({ page: 1 });
      }
    } catch (error) {
      toast.error(
        error.response?.data?.message || "Unable to create menu category"
      );
    } finally {
      setSaving(false);
    }
  };

  const handleEditCategory = (category) => {
    setEditingCategory(category.id);
    setCategoryForm({
      restaurantId: category.restaurantId || category.restaurant?.id || "",
      name: category.name || "",
      sortOrder: category.sortOrder?.toString() || "0",
      isActive: category.isActive !== false,
    });
  };

  const handleUpdateCategory = async (event) => {
    event.preventDefault();
    if (saving || !editingCategory) return;

    if (!categoryForm.name.trim()) {
      toast.warning("Please enter a category name");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: categoryForm.name.trim(),
        sortOrder: parseInt(categoryForm.sortOrder) || 0,
        isActive: categoryForm.isActive,
      };

      const response = await updateMenuCategory(editingCategory, payload);
      const updated = response.data?.data;

      if (updated) {
        toast.success("Menu category updated successfully");
        setEditingCategory(null);
        setCategoryForm(initialCategoryForm);
        await loadCategories();
      }
    } catch (error) {
      toast.error(
        error.response?.data?.message || "Unable to update menu category"
      );
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setEditingCategory(null);
    setCategoryForm(initialCategoryForm);
  };

  const handleDeleteCategory = async (categoryId) => {
    if (deleting[categoryId]) return;

    const confirmed = window.confirm(
      "Are you sure you want to delete this category? This action cannot be undone."
    );
    if (!confirmed) return;

    setDeleting((prev) => ({ ...prev, [categoryId]: true }));
    try {
      await deleteMenuCategory(categoryId);
      toast.success("Menu category deleted successfully");
      await loadCategories();
    } catch (error) {
      toast.error(
        error.response?.data?.message || "Unable to delete menu category"
      );
    } finally {
      setDeleting((prev) => {
        const next = { ...prev };
        delete next[categoryId];
        return next;
      });
    }
  };

  const handlePageChange = (nextPage) => {
    const target = Math.max(1, nextPage);
    if (target === pagination.page || loading) return;
    loadCategories({ page: target });
  };

  const describeRange = (pagination, currentCount) => {
    if (!pagination || pagination.totalItems === 0 || currentCount === 0) {
      return "No records";
    }
    const start = (pagination.page - 1) * pagination.pageSize + 1;
    const end = Math.min(start + currentCount - 1, pagination.totalItems);
    return `Showing ${start}-${end} of ${pagination.totalItems}`;
  };

  return (
    <div className="d-flex flex-column gap-4">
      <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
        <h5 className="mb-0">Menu Categories</h5>
        <Button
          variant="outline-secondary"
          size="sm"
          onClick={() => loadCategories()}
          disabled={loading}
        >
          {loading ? "Refreshing…" : "Refresh"}
        </Button>
      </div>

      <Card className="shadow-sm">
        <Card.Body>
          <Form
            onSubmit={editingCategory ? handleUpdateCategory : handleCreateCategory}
            className="d-flex flex-column gap-3"
          >
            <Row className="g-3">
              <Col md={4}>
                <Form.Group controlId="category-restaurant">
                  <Form.Label>Restaurant</Form.Label>
                  <Form.Select
                    name="restaurantId"
                    value={categoryForm.restaurantId}
                    onChange={handleFormChange}
                    required
                    disabled={editingCategory !== null || restaurants.length === 0}
                  >
                    <option value="">Select restaurant</option>
                    {restaurants.map((restaurant) => (
                      <option key={restaurant.id} value={restaurant.id}>
                        {restaurant.name}
                      </option>
                    ))}
                  </Form.Select>
                </Form.Group>
              </Col>
              <Col md={4}>
                <Form.Group controlId="category-name">
                  <Form.Label>Category Name</Form.Label>
                  <Form.Control
                    name="name"
                    value={categoryForm.name}
                    onChange={handleFormChange}
                    placeholder="e.g. Appetizers, Main Courses"
                    required
                    disabled={saving}
                  />
                </Form.Group>
              </Col>
              <Col md={2}>
                <Form.Group controlId="category-sort-order">
                  <Form.Label>Sort Order</Form.Label>
                  <Form.Control
                    name="sortOrder"
                    type="number"
                    min="0"
                    step="1"
                    value={categoryForm.sortOrder}
                    onChange={handleFormChange}
                    disabled={saving}
                  />
                </Form.Group>
              </Col>
              <Col md={2}>
                <Form.Group controlId="category-active" className="d-flex flex-column">
                  <Form.Label>Status</Form.Label>
                  <Form.Check
                    type="switch"
                    name="isActive"
                    label={categoryForm.isActive ? "Active" : "Inactive"}
                    checked={categoryForm.isActive}
                    onChange={handleFormChange}
                    disabled={saving}
                  />
                </Form.Group>
              </Col>
            </Row>
            <div className="d-flex gap-2">
              <Button type="submit" disabled={saving || restaurants.length === 0}>
                {saving ? (
                  <>
                    <Spinner animation="border" size="sm" className="me-2" />
                    {editingCategory ? "Updating…" : "Creating…"}
                  </>
                ) : editingCategory ? (
                  "Update Category"
                ) : (
                  "Create Category"
                )}
              </Button>
              {editingCategory && (
                <Button
                  type="button"
                  variant="outline-secondary"
                  onClick={handleCancelEdit}
                  disabled={saving}
                >
                  Cancel
                </Button>
              )}
            </div>
            {restaurants.length === 0 && (
              <Alert variant="warning" className="mb-0">
                No restaurants found. Please ensure restaurants exist before creating categories.
              </Alert>
            )}
          </Form>
        </Card.Body>
      </Card>

      <Card className="shadow-sm">
        <Card.Body className="d-flex flex-column gap-3">
          <div className="d-flex justify-content-between align-items-center">
            <h6 className="mb-0">Existing Categories</h6>
            <div className="text-muted small">{categories.length} categories</div>
          </div>

          {loading && categories.length === 0 ? (
            <div className="d-flex justify-content-center py-4">
              <Spinner animation="border" role="status" />
            </div>
          ) : null}

          {!loading && categories.length === 0 ? (
            <Alert variant="light" className="mb-0">
              No menu categories found. Create your first category using the form above.
            </Alert>
          ) : null}

          {categories.length > 0 ? (
            <>
              <div className="table-responsive">
                <Table hover size="sm" className="mb-0">
                  <thead>
                    <tr>
                      <th style={{ width: "25%" }}>Name</th>
                      <th style={{ width: "20%" }}>Restaurant</th>
                      <th style={{ width: "10%" }} className="text-center">
                        Sort Order
                      </th>
                      <th style={{ width: "10%" }} className="text-center">
                        Status
                      </th>
                      <th style={{ width: "10%" }} className="text-center">
                        Menu Items
                      </th>
                      <th style={{ width: "25%" }} className="text-end">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {categories.map((category) => (
                      <tr key={category.id}>
                        <td className="fw-semibold">{category.name}</td>
                        <td>{category.restaurant?.name || "--"}</td>
                        <td className="text-center">{category.sortOrder || 0}</td>
                        <td className="text-center">
                          <Badge bg={category.isActive ? "success" : "secondary"}>
                            {category.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </td>
                        <td className="text-center">
                          <span className="text-muted small">
                            {category.menuItemCount || 0}
                          </span>
                        </td>
                        <td className="text-end">
                          <div className="d-flex gap-1 justify-content-end">
                            <Button
                              variant="outline-primary"
                              size="sm"
                              onClick={() => handleEditCategory(category)}
                              disabled={editingCategory === category.id || saving}
                            >
                              Edit
                            </Button>
                            <Button
                              variant="outline-danger"
                              size="sm"
                              onClick={() => handleDeleteCategory(category.id)}
                              disabled={
                                deleting[category.id] ||
                                saving ||
                                editingCategory === category.id
                              }
                            >
                              {deleting[category.id] ? (
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
                  {describeRange(pagination, categories.length)}
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
    </div>
  );
};

export default MenuCategoriesPanel;
