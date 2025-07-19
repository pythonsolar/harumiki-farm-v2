# Harumiki Smart Farm App

🌱 A modern smart farming management system built with Django and Strawberry GraphQL.

## Features

- 🌡️ **Sensor Monitoring** - Real-time temperature, humidity, and soil moisture tracking
- 💧 **Irrigation Control** - Automated watering system management
- 📊 **Data Analytics** - Historical data visualization and insights
- 📱 **API Ready** - RESTful and GraphQL APIs for mobile integration
- 🔐 **Security** - Authentication and authorization system

## Tech Stack

- **Backend**: Django 5.2.1
- **API**: Strawberry GraphQL
- **Database**: SQLite (Development) / PostgreSQL (Production)
- **Authentication**: Django Auth
- **Deployment**: Docker ready

## Quick Start

### Prerequisites

- Python 3.12+
- Git

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd Harumiki-App-v07
   ```

2. **Create virtual environment**
   ```bash
   python -m venv venv
   venv\Scripts\activate  # Windows
   # source venv/bin/activate  # Linux/Mac
   ```

3. **Install dependencies**
   ```bash
   cd harumiki
   pip install -r requirements.txt
   ```

4. **Environment setup**
   ```bash
   copy .env.example .env
   # Edit .env with your settings
   ```

5. **Database migration**
   ```bash
   python manage.py migrate
   python manage.py createsuperuser
   ```

6. **Run development server**
   ```bash
   python manage.py runserver
   ```

   Visit: http://127.0.0.1:8000/

## Project Structure

```
Harumiki-App-v07/
├── harumiki/                 # Django project
│   ├── harumiki/            # Settings & main config
│   ├── strawberry/          # GraphQL app
│   ├── static/              # Static files
│   ├── logs/                # Application logs
│   ├── manage.py            # Django management
│   ├── .env                 # Environment variables
│   └── requirements.txt     # Python dependencies
├── venv/                    # Virtual environment
├── .gitignore              # Git ignore rules
└── README.md               # This file
```

## API Endpoints

### REST API
- `/api/sensors/` - Sensor data CRUD
- `/api/irrigation/` - Irrigation control
- `/api/users/` - User management

### GraphQL
- `/graphql/` - GraphQL endpoint
- `/graphql/` - GraphQL playground (development)

## Environment Variables

Create `.env` file in `harumiki/` directory:

```env
SECRET_KEY=your-secret-key
DEBUG=True
SMART_FARM_API_URL=https://your-api-url
SMART_FARM_API_KEY=your-api-key
```

## Deployment

### Docker
```bash
docker-compose up -d
```

### Manual Deployment
1. Set `DEBUG=False` in production
2. Configure production database
3. Collect static files: `python manage.py collectstatic`
4. Use production WSGI server (gunicorn)

## Development

### Running Tests
```bash
python manage.py test
```

### Code Quality
```bash
pip install black flake8
black .
flake8 .
```

## Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Contact

- **Developer**: Your Name
- **Email**: your.email@example.com
- **Project Link**: https://github.com/yourusername/harumiki-smart-farm

## Acknowledgments

- Django Framework
- Strawberry GraphQL
- IoT sensor integration libraries