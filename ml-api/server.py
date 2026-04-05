from flask import Flask, Response, jsonify, send_file
from flask_cors import CORS
from model import generate_frames, stop_monitoring, run_monitor

app = Flask(__name__)

CORS(app)   # enables requests from React frontend


@app.route("/video-feed")
def video_feed():

    return Response(
        generate_frames(),
        mimetype='multipart/x-mixed-replace; boundary=frame'
    )


@app.route("/stop-session")
def stop_session():

    stop_monitoring()

    result = run_monitor()   # generates PDF

    return jsonify(result)

import os

@app.route("/download-report")
def download_report():

    file_path = os.path.join(
        os.getcwd(),
        "session_report.pdf"
    )

    return send_file(
        file_path,
        as_attachment=True
    )


if __name__ == "__main__":

    app.run(port=5000, debug=True)