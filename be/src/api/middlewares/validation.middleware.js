import { errorResponse } from '../utils/response.js';

const validationMiddleware = (schema, property = 'body') => (req, res, next) => {
    const { error, value } = schema.validate(req[property], { abortEarly: false, stripUnknown: true });
    if (error) {
        return errorResponse(res, 'Validation failed', 422, error.details.map((d) => d.message));
    }

    req[property] = value;
    return next();
};

export default validationMiddleware;
