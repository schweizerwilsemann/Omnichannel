import { Formik, Form, Field, ErrorMessage } from 'formik';
import { Button, Card } from 'react-bootstrap';
import { invitationAcceptSchema } from '../../validations/auth.validation.js';

const InvitationAcceptForm = ({ initialValues, onSubmit, isLoading }) => (
    <Card className="shadow-sm">
        <Card.Body>
            <h3 className="mb-4">Accept Invitation</h3>
            <Formik
                initialValues={initialValues}
                enableReinitialize
                validationSchema={invitationAcceptSchema}
                onSubmit={onSubmit}
            >
                {({ handleSubmit }) => (
                    <Form onSubmit={handleSubmit}>
                        <div className="mb-3">
                            <label className="form-label">Invitation Identifier</label>
                            <Field name="tokenIdentifier" className="form-control" />
                            <div className="text-danger small">
                                <ErrorMessage name="tokenIdentifier" />
                            </div>
                        </div>
                        <div className="mb-3">
                            <label className="form-label">Invitation Token</label>
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
                        <div className="mb-3">
                            <label className="form-label">Phone Number</label>
                            <Field name="phoneNumber" className="form-control" />
                            <div className="text-danger small">
                                <ErrorMessage name="phoneNumber" />
                            </div>
                        </div>
                        <Button type="submit" disabled={isLoading}>
                            {isLoading ? 'Submitting…' : 'Accept Invitation'}
                        </Button>
                    </Form>
                )}
            </Formik>
        </Card.Body>
    </Card>
);

export default InvitationAcceptForm;
