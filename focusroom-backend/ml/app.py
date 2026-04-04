from flask import Flask, request, jsonify
from flask_cors import CORS
from attention import analyze_frame

app = Flask(__name__)
CORS(app)  # allow React frontend to call this

@app.route('/analyze', methods=['POST'])
def analyze():
    """
    Receives a base64 webcam frame from the frontend.
    Returns attention state, posture state, and head pose data.
    """
    data = request.get_json()
    if not data or 'frame' not in data:
        return jsonify({'error': 'no frame provided'}), 400

    result = analyze_frame(data['frame'])
    return jsonify(result)

@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok', 'model': 'mediapipe'})

if __name__ == '__main__':
    print("🧠 FocusRoom ML server running on http://localhost:5001")
    app.run(port=5001, debug=True)
