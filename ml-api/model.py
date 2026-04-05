import cv2
import time
from ultralytics import YOLO
import google.generativeai as genai
from reportlab.pdfgen import canvas
import os
import cv2
from ultralytics import YOLO

camera_running = True

def stop_monitoring():

    global camera_running

    camera_running = False


def generate_frames():

    global camera_running

    camera_running = True

    phone_model = YOLO("yolov8n.pt")

    face_cascade = cv2.CascadeClassifier(
        cv2.data.haarcascades +
        "haarcascade_frontalface_default.xml"
    )

    eye_cascade = cv2.CascadeClassifier(
        cv2.data.haarcascades +
        "haarcascade_eye.xml"
    )

    cap = cv2.VideoCapture(0)

    while camera_running:

        success, frame = cap.read()

        if not success:
            break

        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)

        faces = face_cascade.detectMultiScale(gray,1.3,5)

        for (x,y,w,h) in faces:

            cv2.rectangle(
                frame,
                (x,y),
                (x+w,y+h),
                (0,255,0),
                2
            )


        ret, buffer = cv2.imencode('.jpg', frame)

        frame = buffer.tobytes()

        yield (
            b'--frame\r\n'
            b'Content-Type: image/jpeg\r\n\r\n'
            + frame +
            b'\r\n'
        )

    cap.release()

genai.configure(
 api_key=os.getenv("GEMINI_API_KEY")
)

# ---------------- GEMINI CONFIG ----------------
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))


def generate_ai_report(metrics):

    prompt = f"""
    You are an AI study coach.

    Analyse student's study behaviour:

    Sleep events: {metrics["sleep"]}
    Yawns: {metrics["yawn"]}
    Phone usage: {metrics["phone"]}
    Distraction percentage: {metrics["distraction"]}
    Average blink gap: {metrics["avgBlink"]}
    Session duration: {metrics["duration"]} seconds

    Provide:

    1. Overall focus rating (Poor/Average/Good/Excellent)
    2. Key behaviour insights
    3. 3 improvement suggestions
    4. 1 motivational line

    Keep answer under 120 words.
    """

    model = genai.GenerativeModel("gemini-1.5-flash")

    response = model.generate_content(prompt)

    return response.text


# ---------------- MAIN MONITOR FUNCTION ----------------

def run_monitor():

    phone_model = YOLO("yolov8n.pt")

    SLEEP_FRAMES = 35
    DISTRACTION_FRAMES = 20
    YAWN_FRAMES = 15

    sleep_counter = 0
    distraction_counter = 0
    yawn_counter = 0

    total_frames = 0
    distracted_frames = 0

    blink_start_time = None
    blink_intervals = []

    prev_face_x = None

    face_cascade = cv2.CascadeClassifier(
        cv2.data.haarcascades +
        "haarcascade_frontalface_default.xml"
    )

    eye_cascade = cv2.CascadeClassifier(
        cv2.data.haarcascades +
        "haarcascade_eye.xml"
    )

    mouth_cascade = cv2.CascadeClassifier(
        cv2.data.haarcascades +
        "haarcascade_smile.xml"
    )

    log = {
        "sleep": 0,
        "yawn": 0,
        "phone": 0
    }

    start_time = time.time()

    cap = cv2.VideoCapture(0)

    while True:

        ret, frame = cap.read()

        if not ret:
            break

        total_frames += 1

        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)

        faces = face_cascade.detectMultiScale(gray, 1.3, 5)

        for (x,y,w,h) in faces:

            face = gray[y:y+h, x:x+w]

            eyes = eye_cascade.detectMultiScale(face)

            mouth = mouth_cascade.detectMultiScale(face,1.7,20)


            # sleep detection
            eyes_closed = True

            for (_,_,_,eh) in eyes:

                if eh > 8:
                    eyes_closed = False


            if eyes_closed:

                sleep_counter += 1

                if blink_start_time is None:
                    blink_start_time = time.time()

            else:

                if blink_start_time is not None:

                    blink_intervals.append(
                        time.time() - blink_start_time
                    )

                    blink_start_time = None

                sleep_counter = 0


            if sleep_counter > SLEEP_FRAMES:

                log["sleep"] += 1

                sleep_counter = 0


            # yawn detection
            if len(mouth) > 0:

                yawn_counter += 1

            else:

                if yawn_counter > YAWN_FRAMES:

                    log["yawn"] += 1

                yawn_counter = 0


            # distraction detection
            if prev_face_x is not None:

                if abs(x-prev_face_x) > 25:

                    distraction_counter += 1

                else:

                    distraction_counter = max(
                        0,
                        distraction_counter-1
                    )


            if distraction_counter > DISTRACTION_FRAMES:

                distracted_frames += 1

                distraction_counter = 0


            prev_face_x = x


        # phone detection
        results = phone_model(frame, verbose=False)

        for r in results:

            for box in r.boxes:

                cls = int(box.cls[0])

                if phone_model.names[cls] == "cell phone":

                    log["phone"] += 1


        cv2.imshow("Monitoring", frame)

        # press q to stop session
        if cv2.waitKey(1) == ord("q"):
            break


    cap.release()
    cv2.destroyAllWindows()


    # --------- METRICS ---------

    avg_no_blink = 0

    if len(blink_intervals) > 0:

        avg_no_blink = sum(
            blink_intervals
        ) / len(blink_intervals)


    distraction_percent = 0

    if total_frames > 0:

        distraction_percent = (
            distracted_frames /
            total_frames
        ) * 100


    session_duration = round(
        time.time() - start_time
    )


    metrics = {

        "sleep": log["sleep"],

        "yawn": log["yawn"],

        "phone": log["phone"],

        "distraction": round(distraction_percent,2),

        "avgBlink": round(avg_no_blink,2),

        "duration": session_duration
    }


    # -------- GEMINI REPORT --------

    ai_feedback = generate_ai_report(metrics)


    # -------- PDF REPORT --------

    c = canvas.Canvas("session_report.pdf")

    c.setFont("Helvetica",16)

    c.drawString(180,800,"SESSION REPORT")

    c.setFont("Helvetica",12)

    y = 740

    c.drawString(100,y,f"Sleep events: {metrics['sleep']}")
    y -= 25

    c.drawString(100,y,f"Yawns: {metrics['yawn']}")
    y -= 25

    c.drawString(100,y,f"Phone usage: {metrics['phone']}")
    y -= 25

    c.drawString(100,y,
        f"Distraction %: {metrics['distraction']}")
    y -= 25

    c.drawString(100,y,
        f"Avg blink gap: {metrics['avgBlink']} sec")
    y -= 25

    c.drawString(100,y,
        f"Session duration: {metrics['duration']} sec")
    y -= 40


    c.drawString(100,y,"AI Study Insights:")
    y -= 20

    text = c.beginText(100,y)

    text.setFont("Helvetica",11)

    for line in ai_feedback.split("\n"):

        text.textLine(line)

    c.drawText(text)

    c.save()


    return {

        "metrics": metrics,

        "ai_report": ai_feedback
    }