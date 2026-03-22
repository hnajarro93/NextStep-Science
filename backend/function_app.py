import azure.functions as func
import azure.durable_functions as df

from blueprints.orchestrators import bp as orchestrator_bp
from blueprints.activities import bp as activities_bp
from blueprints.starters import bp as starters_bp

app = df.DFApp(http_auth_level=func.AuthLevel.FUNCTION)

app.register_functions(orchestrator_bp)
app.register_functions(activities_bp)
app.register_functions(starters_bp)