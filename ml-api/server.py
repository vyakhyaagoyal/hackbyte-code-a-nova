from flask import Flask, Response, jsonify
from model import generate_frames, stop_monitoring

app = Flask(__name__)


@app.route("/video-feed")
def video_feed():

    return Response(
        generate_frames(),
        mimetype='multipart/x-mixed-replace; boundary=frame'
    )


@app.route("/stop-session")
def stop_session():

    stop_monitoring()

    return jsonify({"status":"stopped"})


if __name__ == "__main__":

    app.run(port=5000, debug=True)