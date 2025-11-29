import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // Log error to console (always log errors)
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({
      error,
      errorInfo,
    });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="chart-container">
          <div
            style={{
              padding: "2rem",
              textAlign: "center",
              maxWidth: "800px",
              margin: "0 auto",
            }}
          >
            <div
              style={{
                color: "#ef4444",
                fontSize: "1.5rem",
                marginBottom: "1rem",
                fontWeight: "bold",
              }}
            >
              ⚠️ Something went wrong
            </div>
            <div
              style={{
                fontSize: "1rem",
                color: "#64748b",
                marginBottom: "1.5rem",
              }}
            >
              An unexpected error occurred while rendering the chart.
            </div>
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details
                style={{
                  textAlign: "left",
                  marginTop: "1rem",
                  padding: "1rem",
                  backgroundColor: "#f1f5f9",
                  borderRadius: "8px",
                  fontSize: "0.9rem",
                }}
              >
                <summary style={{ cursor: "pointer", fontWeight: "600" }}>
                  Error Details (Development Only)
                </summary>
                <pre
                  style={{
                    marginTop: "0.5rem",
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                  }}
                >
                  {this.state.error.toString()}
                  {this.state.errorInfo && (
                    <>
                      {"\n\n"}
                      {this.state.errorInfo.componentStack}
                    </>
                  )}
                </pre>
              </details>
            )}
            <button
              onClick={this.handleReset}
              style={{
                marginTop: "1.5rem",
                padding: "0.75rem 1.5rem",
                backgroundColor: "#6366f1",
                color: "white",
                border: "none",
                borderRadius: "8px",
                cursor: "pointer",
                fontSize: "1rem",
                fontWeight: "500",
              }}
              onMouseOver={(e) => {
                e.target.style.backgroundColor = "#4f46e5";
              }}
              onMouseOut={(e) => {
                e.target.style.backgroundColor = "#6366f1";
              }}
            >
              Try Again
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;

