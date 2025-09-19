import { Formik, Form, Field, ErrorMessage } from 'formik';
import { Button, Card } from 'react-bootstrap';
import { loginValidationSchema } from '../../validations/auth.validation.js';

const LoginForm = ({ onSubmit, isLoading }) => (
    <Card className="shadow-sm">
        <Card.Body>
            <h3 className="mb-4">Admin Login</h3>
            <Formik
                initialValues={{ email: '', password: '' }}
                validationSchema={loginValidationSchema}
                onSubmit={onSubmit}
            >
                {({ handleSubmit }) => (
                    <Form onSubmit={handleSubmit}>
                        <div className="mb-3">
                            <label className="form-label">Email</label>
                            <Field name="email" type="email" className="form-control" placeholder="admin@example.com" />
                            <div className="text-danger small">
                                <ErrorMessage name="email" />
                            </div>
                        </div>
                        <div className="mb-3">
                            <label className="form-label">Password</label>
                            <Field name="password" type="password" className="form-control" placeholder="••••••••" />
                            <div className="text-danger small">
                                <ErrorMessage name="password" />
                            </div>
                        </div>
                        <div className="d-flex justify-content-between align-items-center">
                            <Button type="submit" disabled={isLoading}>
                                {isLoading ? 'Signing in…' : 'Login'}
                            </Button>
                            <a href="/password-reset">Forgot password?</a>
                        </div>
                    </Form>
                )}
            </Formik>
        </Card.Body>
    </Card>
);

export default LoginForm;
