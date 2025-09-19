import { Formik, Form, Field, ErrorMessage } from 'formik';
import { Button, Card } from 'react-bootstrap';
import { passwordResetRequestSchema } from '../../validations/auth.validation.js';

const PasswordResetRequestForm = ({ onSubmit, isLoading }) => (
    <Card className="shadow-sm">
        <Card.Body>
            <h3 className="mb-4">Reset Password</h3>
            <Formik
                initialValues={{ email: '' }}
                validationSchema={passwordResetRequestSchema}
                onSubmit={onSubmit}
            >
                {({ handleSubmit }) => (
                    <Form onSubmit={handleSubmit}>
                        <div className="mb-3">
                            <label className="form-label">Email</label>
                            <Field name="email" type="email" className="form-control" />
                            <div className="text-danger small">
                                <ErrorMessage name="email" />
                            </div>
                        </div>
                        <Button type="submit" disabled={isLoading}>
                            {isLoading ? 'Sending…' : 'Send Reset Link'}
                        </Button>
                    </Form>
                )}
            </Formik>
        </Card.Body>
    </Card>
);

export default PasswordResetRequestForm;
