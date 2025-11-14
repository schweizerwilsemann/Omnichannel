import React from "react";
import MainLayout from "../components/layout/MainLayout.jsx";
import RestaurantsPanel from "../components/restaurants/RestaurantsPanel.jsx";

const RestaurantsPage = () => {
  return (
    <MainLayout>
      <div className="d-flex flex-column gap-4">
        <div className="d-flex flex-wrap justify-content-between align-items-center gap-2">
          <div>
            <h2 className="mb-1">Restaurants</h2>
            <p className="text-muted mb-0">
              Manage all restaurants in the system, including their settings,
              addresses, and operational hours.
            </p>
          </div>
        </div>

        <RestaurantsPanel />
      </div>
    </MainLayout>
  );
};

export default RestaurantsPage;
