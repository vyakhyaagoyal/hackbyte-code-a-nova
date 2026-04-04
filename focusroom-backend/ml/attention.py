import cv2
import mediapipe as mp
import numpy as np
import base64
import math

# ── MediaPipe setup (loaded once, reused every frame) ──
mp_face_mesh = mp.solutions.face_mesh
mp_pose = mp.solutions.pose

face_mesh = mp_face_mesh.FaceMesh(
    max_num_faces=1,
    refine_landmarks=True,        # enables iris tracking
    min_detection_confidence=0.5,
    min_tracking_confidence=0.5
)

pose = mp_pose.Pose(
    min_detection_confidence=0.5,
    min_tracking_confidence=0.5
)

# ── Landmark indices ──
# Face
NOSE_TIP       = 1
LEFT_EYE_INNER = 133
RIGHT_EYE_INNER= 362
LEFT_EAR       = 234
RIGHT_EAR      = 454
CHIN           = 152
FOREHEAD       = 10

# Iris (only available with refine_landmarks=True)
LEFT_IRIS  = 468
RIGHT_IRIS = 473

# Eyes open/closed (upper & lower lid)
LEFT_EYE_TOP    = 159
LEFT_EYE_BOTTOM = 145
RIGHT_EYE_TOP   = 386
RIGHT_EYE_BOTTOM= 374

# Pose
LEFT_SHOULDER  = mp_pose.PoseLandmark.LEFT_SHOULDER
RIGHT_SHOULDER = mp_pose.PoseLandmark.RIGHT_SHOULDER
LEFT_EAR_POSE  = mp_pose.PoseLandmark.LEFT_EAR
RIGHT_EAR_POSE = mp_pose.PoseLandmark.RIGHT_EAR
NOSE_POSE      = mp_pose.PoseLandmark.NOSE


def decode_frame(b64_string: str) -> np.ndarray | None:
    """Convert base64 image string → OpenCV BGR frame."""
    try:
        # Strip data URI prefix if present (data:image/jpeg;base64,...)
        if ',' in b64_string:
            b64_string = b64_string.split(',')[1]
        img_bytes = base64.b64decode(b64_string)
        arr = np.frombuffer(img_bytes, dtype=np.uint8)
        frame = cv2.imdecode(arr, cv2.IMREAD_COLOR)
        return frame
    except Exception as e:
        print(f"[decode_frame] error: {e}")
        return None


def get_head_pose(landmarks, w, h):
    """
    Estimate head yaw (left/right turn) and pitch (up/down tilt)
    from face mesh landmarks.
    Returns: (yaw_deg, pitch_deg)
    """
    nose   = landmarks[NOSE_TIP]
    l_ear  = landmarks[LEFT_EAR]
    r_ear  = landmarks[RIGHT_EAR]
    chin   = landmarks[CHIN]
    forehead = landmarks[FOREHEAD]

    # Yaw: horizontal offset of nose from midpoint of ears
    ear_mid_x = (l_ear.x + r_ear.x) / 2
    ear_width  = abs(l_ear.x - r_ear.x)
    yaw_ratio  = (nose.x - ear_mid_x) / (ear_width + 1e-6)
    yaw_deg    = yaw_ratio * 90  # rough mapping

    # Pitch: vertical offset of nose from midpoint of chin/forehead
    face_mid_y = (chin.y + forehead.y) / 2
    face_height = abs(chin.y - forehead.y)
    pitch_ratio = (nose.y - face_mid_y) / (face_height + 1e-6)
    pitch_deg   = pitch_ratio * 60

    return yaw_deg, pitch_deg


def get_eye_openness(landmarks):
    """
    Compute eye aspect ratio (EAR) to detect closed/drowsy eyes.
    EAR < 0.2 → eyes closed, < 0.25 → drowsy
    """
    def ear(top_idx, bottom_idx, inner_idx, outer_idx):
        top    = landmarks[top_idx]
        bottom = landmarks[bottom_idx]
        inner  = landmarks[inner_idx]
        outer  = landmarks[RIGHT_EYE_INNER if inner_idx == LEFT_EYE_INNER else LEFT_EYE_INNER]
        vertical   = abs(top.y - bottom.y)
        horizontal = abs(inner.x - outer.x) + 1e-6
        return vertical / horizontal

    left_ear  = ear(LEFT_EYE_TOP, LEFT_EYE_BOTTOM, LEFT_EYE_INNER, RIGHT_EYE_INNER)
    right_ear = ear(RIGHT_EYE_TOP, RIGHT_EYE_BOTTOM, RIGHT_EYE_INNER, LEFT_EYE_INNER)
    return (left_ear + right_ear) / 2


def get_gaze_direction(landmarks):
    """
    Use iris position relative to eye corners to estimate gaze.
    Returns: 'center', 'left', 'right', 'up', 'down'
    """
    try:
        left_iris  = landmarks[LEFT_IRIS]
        right_iris = landmarks[RIGHT_IRIS]

        l_inner = landmarks[LEFT_EYE_INNER]
        l_outer = landmarks[LEFT_EAR]   # approximate outer corner
        r_inner = landmarks[RIGHT_EYE_INNER]
        r_outer = landmarks[RIGHT_EAR]

        # Left eye gaze
        l_eye_width = abs(l_inner.x - l_outer.x) + 1e-6
        l_gaze_x = (left_iris.x - l_outer.x) / l_eye_width  # 0=left, 1=right

        # Right eye gaze
        r_eye_width = abs(r_inner.x - r_outer.x) + 1e-6
        r_gaze_x = (right_iris.x - r_outer.x) / r_eye_width

        avg_gaze = (l_gaze_x + r_gaze_x) / 2

        if avg_gaze < 0.35:
            return 'left'
        elif avg_gaze > 0.65:
            return 'right'
        return 'center'
    except:
        return 'center'


def analyze_posture(pose_landmarks, w, h):
    """
    Detect slouching using:
    1. Shoulder symmetry (one shoulder higher = slouching sideways)
    2. Ear-to-shoulder distance (ears far forward = head jutting = slouching)
    3. Shoulder height relative to frame (shoulders rising = tension)

    Returns: { 'state': 'good'|'slouching'|'tilted', 'score': 0-100, 'details': str }
    """
    if not pose_landmarks:
        return {'state': 'unknown', 'score': 100, 'details': 'no pose detected'}

    lm = pose_landmarks.landmark
    l_shoulder = lm[LEFT_SHOULDER.value]
    r_shoulder = lm[RIGHT_SHOULDER.value]
    l_ear      = lm[LEFT_EAR_POSE.value]
    r_ear      = lm[RIGHT_EAR_POSE.value]
    nose       = lm[NOSE_POSE.value]

    issues = []
    score  = 100

    # 1. Shoulder tilt (y difference)
    shoulder_diff = abs(l_shoulder.y - r_shoulder.y)
    if shoulder_diff > 0.06:
        issues.append('shoulders uneven')
        score -= 30

    # 2. Head forward posture: ears should be roughly above shoulders
    ear_mid_x      = (l_ear.x + r_ear.x) / 2
    shoulder_mid_x = (l_shoulder.x + r_shoulder.x) / 2
    forward_offset = abs(ear_mid_x - shoulder_mid_x)
    if forward_offset > 0.08:
        issues.append('head jutting forward')
        score -= 25

    # 3. Neck bend: ears should not be significantly lower than expected
    ear_mid_y      = (l_ear.y + r_ear.y) / 2
    shoulder_mid_y = (l_shoulder.y + r_shoulder.y) / 2
    neck_ratio     = ear_mid_y / (shoulder_mid_y + 1e-6)
    if neck_ratio > 0.78:   # ears too close to shoulders = slouching down
        issues.append('slouching down')
        score -= 35

    score = max(0, score)

    if score >= 75:
        state = 'good'
    elif score >= 45:
        state = 'slouching'
    else:
        state = 'bad'

    return {
        'state':   state,
        'score':   score,
        'details': ', '.join(issues) if issues else 'posture looks good'
    }


def classify_attention(yaw_deg, pitch_deg, ear_score, gaze, face_detected):
    """
    Combine all signals into a single attention state.

    Returns: { 'state': str, 'score': int, 'reason': str }
    States: 'focused', 'distracted', 'looking_away', 'drowsy', 'absent'
    """
    if not face_detected:
        return {'state': 'absent', 'score': 0, 'reason': 'face not in frame'}

    # Drowsiness check
    if ear_score < 0.18:
        return {'state': 'drowsy', 'score': 20, 'reason': 'eyes closing — might be sleepy'}

    # Head turned away
    if abs(yaw_deg) > 25:
        direction = 'left' if yaw_deg < 0 else 'right'
        return {'state': 'looking_away', 'score': 30,
                'reason': f'head turned {direction} ({abs(yaw_deg):.0f}°)'}

    # Head pitched down too much (phone / notes under desk)
    if pitch_deg > 20:
        return {'state': 'distracted', 'score': 40,
                'reason': 'looking down — phone or notes?'}

    # Head pitched up too much
    if pitch_deg < -20:
        return {'state': 'distracted', 'score': 40,
                'reason': 'looking up — daydreaming?'}

    # Gaze direction
    if gaze in ('left', 'right'):
        return {'state': 'distracted', 'score': 55,
                'reason': f'eyes looking {gaze}'}

    # All good
    score = 100 - int(abs(yaw_deg) * 1.5) - int(abs(pitch_deg))
    score = max(60, min(100, score))
    return {'state': 'focused', 'score': score, 'reason': 'on track 👍'}


def analyze_frame(b64_frame: str) -> dict:
    """
    Main entry point.
    Input:  base64-encoded JPEG/PNG frame from webcam
    Output: dict with attention + posture analysis
    """
    frame = decode_frame(b64_frame)
    if frame is None:
        return {
            'attention': {'state': 'absent', 'score': 0, 'reason': 'could not decode frame'},
            'posture':   {'state': 'unknown', 'score': 100, 'details': ''},
            'face_detected': False
        }

    h, w = frame.shape[:2]
    rgb   = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)

    # ── Run MediaPipe ──
    face_results = face_mesh.process(rgb)
    pose_results = pose.process(rgb)

    face_detected = bool(face_results.multi_face_landmarks)

    # ── Face / attention analysis ──
    if face_detected:
        lm = face_results.multi_face_landmarks[0].landmark
        yaw, pitch = get_head_pose(lm, w, h)
        ear_score  = get_eye_openness(lm)
        gaze       = get_gaze_direction(lm)
    else:
        yaw, pitch, ear_score, gaze = 0, 0, 0.3, 'center'

    attention = classify_attention(yaw, pitch, ear_score, gaze, face_detected)

    # ── Posture analysis ──
    posture = analyze_posture(
        pose_results.pose_landmarks if pose_results else None,
        w, h
    )

    return {
        'attention':    attention,
        'posture':      posture,
        'face_detected': face_detected,
        'raw': {
            'yaw_deg':   round(yaw, 1) if face_detected else None,
            'pitch_deg': round(pitch, 1) if face_detected else None,
            'ear':       round(ear_score, 3) if face_detected else None,
            'gaze':      gaze
        }
    }
