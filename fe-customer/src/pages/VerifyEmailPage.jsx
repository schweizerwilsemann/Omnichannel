import { useEffect, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Spinner, Button } from "react-bootstrap";
import { toast } from "react-toastify";
import { verifyMembershipToken, fetchMenu, fetchActiveSession } from "../services/session.js";
import { useSession } from "../context/SessionContext.jsx";

const buildMembershipMessage = ({ alreadyVerified, infoMessage }) => {
    if (infoMessage) {
        return infoMessage;
    }
    if (alreadyVerified) {
        return "Membership already verified. You can return to the ordering screen when you are ready.";
    }
    return "Verification complete. Redirecting.";
};

const VerifyEmailPage = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { session, updateSession } = useSession();

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [infoMessage, setInfoMessage] = useState(null);
    const [canNavigateManually, setCanNavigateManually] = useState(false);

    const resolvedTokenRef = useRef(null);
    const alreadyVerifiedRef = useRef(false);

    const hydrateSession = async (sessionToken, fallbackStatus, payloadMembership = null) => {
        if (!sessionToken) {
            return false;
        }

        try {
            const [sessionRes, menuRes] = await Promise.all([
                fetchActiveSession(sessionToken).catch(() => null),
                fetchMenu(sessionToken).catch(() => null)
            ]);

            const sessionPayload = sessionRes?.data?.data || null;
            const menuPayload = menuRes?.data?.data || null;
            const membership = menuPayload?.session?.membership || payloadMembership || session?.membership || null;
            const membershipStatus = menuPayload?.session?.membershipStatus || fallbackStatus || null;

            updateSession({
                sessionToken,
                membership,
                membershipStatus,
                membershipPending: false,
                restaurant: sessionPayload?.restaurant || session?.restaurant || null,
                restaurantId: sessionPayload?.restaurantId || session?.restaurantId || null,
                table: sessionPayload?.table || (menuPayload?.session?.tableName ? { name: menuPayload.session.tableName } : session?.table || null),
                tableId: sessionPayload?.tableId || session?.tableId || null
            });

            return true;
        } catch (hydrateError) {
            console.warn("Unable to hydrate session after verification", hydrateError);
            updateSession({ membershipStatus: fallbackStatus, membershipPending: false });
            return false;
        }
    };

    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const verificationId = params.get("verificationId");
        const token = params.get("token");

        if (!verificationId || !token) {
            setError("Invalid verification link");
            setLoading(false);
            return;
        }

        const run = async () => {
            try {
                setLoading(true);
                setError(null);
                setInfoMessage(null);
                setCanNavigateManually(false);

                const response = await verifyMembershipToken({ verificationId, token });
                const payload = response.data?.data || {};
                const alreadyVerified = Boolean(payload.alreadyVerified);
                const statusLabel = alreadyVerified
                    ? "Membership already verified. You can keep ordering!"
                    : payload.membershipStatus === "MEMBER"
                    ? "Membership verified - welcome!"
                    : "Membership verified";
                toast.success(statusLabel);

                const fallbackStatus = payload.membershipStatus || session?.membershipStatus || null;
                const sessionTokenParam = params.get("sessionToken");
                const resolvedToken = payload.sessionToken || session?.sessionToken || sessionTokenParam || null;

                resolvedTokenRef.current = resolvedToken;
                alreadyVerifiedRef.current = alreadyVerified;

                let shouldNavigateHome = Boolean(resolvedToken) && !alreadyVerified;

                if (resolvedToken) {
                    const hydrated = await hydrateSession(resolvedToken, fallbackStatus, payload.membership || null);
                    if (!hydrated) {
                        setInfoMessage("Membership verified. Return to your ordering tab to continue ordering.");
                    }
                    shouldNavigateHome = shouldNavigateHome && hydrated;
                    setCanNavigateManually(alreadyVerified || !hydrated);
                } else {
                    updateSession({ membershipPending: false, membershipStatus: fallbackStatus });
                    setInfoMessage("Membership verified. Return to your ordering tab to continue ordering.");
                    setCanNavigateManually(true);
                }

                if (alreadyVerified) {
                    setInfoMessage("Membership already verified. Use the button below to return to the ordering page.");
                }

                if (shouldNavigateHome) {
                    navigate("/");
                }
            } catch (err) {
                const message = err.response?.data?.message || err.message || "Unable to verify membership";
                setError(message);
                toast.error(message);
            } finally {
                setLoading(false);
            }
        };

        run();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleReturnToOrdering = async () => {
        const token = resolvedTokenRef.current || session?.sessionToken || null;

        if (!token) {
            navigate("/");
            return;
        }

        try {
            setLoading(true);
            setError(null);

            const hydrated = await hydrateSession(token, session?.membershipStatus || null, session?.membership || null);
            if (hydrated) {
                navigate("/");
            } else {
                setInfoMessage("Membership verified. Return to your ordering tab to continue ordering.");
                setCanNavigateManually(true);
            }
        } catch (err) {
            const message = err.response?.data?.message || err.message || "Unable to refresh session";
            setError(message);
            toast.error(message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="d-flex align-items-center justify-content-center" style={{ minHeight: "60vh" }}>
            <div className="card p-4" style={{ maxWidth: 640, width: "100%" }}>
                <h3 className="h5 mb-3">Verifying your membership.</h3>
                {loading ? (
                    <div className="d-flex align-items-center gap-2">
                        <Spinner animation="border" size="sm" />
                        <span>Verifying - please wait</span>
                    </div>
                ) : error ? (
                    <>
                        <p className="text-danger">{error}</p>
                        <Button onClick={() => navigate("/")}>Back to menu</Button>
                    </>
                ) : (
                    <>
                        <p className="text-muted mb-3">
                            {buildMembershipMessage({ alreadyVerified: alreadyVerifiedRef.current, infoMessage })}
                        </p>
                        {canNavigateManually ? (
                            <Button onClick={handleReturnToOrdering} disabled={loading}>
                                Back to ordering page
                            </Button>
                        ) : null}
                    </>
                )}
            </div>
        </div>
    );
};

export default VerifyEmailPage;
