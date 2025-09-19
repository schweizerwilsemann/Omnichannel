export const successResponse = (res, data, status = 200) => {
    res.status(status).json({ data });
};

export const errorResponse = (res, message, status = 400, details) => {
    res.status(status).json({ message, details });
};
