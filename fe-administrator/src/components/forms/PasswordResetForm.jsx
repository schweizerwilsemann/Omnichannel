import { Formik, Form, Field, ErrorMessage } from 'formik';
import { Button, Card } from 'react-bootstrap';
import { passwordResetSchema } from '../../validations/auth.validation.js';

const PasswordResetForm = ({ initialValues, onSubmit, isLoading }) => (
    <Card className="shadow-sm">
        <Card.Body>
            <h3 className="mb-4">Choose New Password</h3>
            <Formik
                initialValues={initialValues}
                enableReinitialize
                validationSchema={passwordResetSchema}
                onSubmit={onSubmit}
            >
                {({ handleSubmit }) => (
                    <Form onSubmit={handleSubmit}>
                        <div className="mb-3">
                            <label className="form-label">Reset ID</label>
                            <Field name="resetId" className="form-control" />
                            <div className="text-danger small">
                                <ErrorMessage name="resetId" />
                            </div>
                        </div>
                        <div className="mb-3">
                            <label className="form-label">Token</label>
                            <Field name="token" className="form-control" />
                            <div className="text-danger small">
                                <ErrorMessage name="token" />
                            </div>
                        </div>
                        <div className="mb-3">
                            <label className="form-label">Password</label>
                            <Field name="password" type="password" className="form-control" />
                            <div className="text-danger small">
                                <ErrorMessage name="password" />
                            </div>
                        </div>
                        <Button type="submit" disabled={isLoading}>
                            {isLoading ? 'Updating…' : 'Update Password'}
                        </Button>
                    </Form>
                )}
            </Formik>
        </Card.Body>
    </Card>
);

export default PasswordResetForm;
