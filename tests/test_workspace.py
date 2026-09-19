import json
import unittest
from types import SimpleNamespace
from unittest.mock import patch

from fastapi.testclient import TestClient
import main


class WorkspaceContractTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(main.app)

    def test_frontend_and_assets_are_served(self):
        response = self.client.get('/')
        self.assertEqual(response.status_code, 200)
        self.assertIn('notebookTabs', response.text)
        for asset in ('app.js', 'app.css'):
            response = self.client.get('/static/' + asset)
            self.assertEqual(response.status_code, 200)
            self.assertGreater(len(response.content), 100)

    def test_tutor_keeps_error_coordinates_and_latex_contract(self):
        result = dict(is_correct_so_far=False, status_message='Review this step.',
                      errors=[dict(problem_label='Derivative', error_type='logical',
                                   correction_message='Which rule applies to a product?',
                                   error_location_x=0.25, error_location_y=0.6)],
                      faint_hint=None, hint_location_x=None, hint_location_y=None,
                      current_latex=r'\frac{d}{dx}(xf(x))')
        generate = unittest.mock.Mock(return_value=SimpleNamespace(text=json.dumps(result)))
        fake = SimpleNamespace(models=SimpleNamespace(generate_content=generate))
        with patch.object(main, 'get_client', return_value=fake):
            response = self.client.post('/tutor', json=dict(image_data='aW1hZ2U=', action_type='check_logic', is_selection=True))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), result)
        self.assertIn('cropped image', generate.call_args.kwargs['contents'][1])

    def test_hint_is_directional_and_does_not_request_evaluation(self):
        result = dict(is_correct_so_far=True, status_message='A nudge for your next step.',
                      errors=[], faint_hint='Which rule connects an integral to a rate of change?',
                      hint_location_x=0.44, hint_location_y=0.38,
                      current_latex=r'F(x)=\int_a^x f(t)\,dt')
        generate = unittest.mock.Mock(return_value=SimpleNamespace(text=json.dumps(result)))
        fake = SimpleNamespace(models=SimpleNamespace(generate_content=generate))
        with patch.object(main, 'get_client', return_value=fake):
            response = self.client.post('/tutor', json=dict(image_data='aW1hZ2U=', action_type='get_hint'))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), result)
        prompt = generate.call_args.kwargs['contents'][1]
        self.assertIn('faintest useful conceptual nudge', prompt)
        self.assertIn('Do not grade', prompt)

    def test_selected_hint_includes_student_sticking_point(self):
        result = dict(is_correct_so_far=True, status_message='A starting nudge.',
                      errors=[], faint_hint='Which definition describes the objects in the problem?',
                      hint_location_x=0.5, hint_location_y=0.5,
                      current_latex='')
        generate = unittest.mock.Mock(return_value=SimpleNamespace(text=json.dumps(result)))
        fake = SimpleNamespace(models=SimpleNamespace(generate_content=generate))
        with patch.object(main, 'get_client', return_value=fake):
            response = self.client.post('/tutor', json=dict(image_data='aW1hZ2U=', action_type='get_hint',
                                                             is_selection=True, hint_focus='start'))
        self.assertEqual(response.status_code, 200)
        prompt = generate.call_args.kwargs['contents'][1]
        self.assertIn('does not know how to start', prompt)
        self.assertIn('selected this region', prompt)

    def test_missing_key_has_actionable_response(self):
        with patch.object(main, '_client', None), patch.object(main, 'get_api_key', side_effect=RuntimeError('missing')):
            response = self.client.post('/tutor', json=dict(image_data='aW1hZ2U=', action_type='get_hint'))
        self.assertEqual(response.status_code, 503)
        self.assertIn('GEMINI_API_KEY', response.json()['detail'])

    def test_notebook_history_reaches_diagnostics(self):
        result = dict(overall_summary='Practice the product rule.', mastery_score=60,
                      strong_points=['Setup'], weak_points=['Product rule'],
                      frequent_pitfalls=['Dropping a term'], actionable_advice=['Review both factors'])
        generate = unittest.mock.Mock(return_value=SimpleNamespace(text=json.dumps(result)))
        fake = SimpleNamespace(models=SimpleNamespace(generate_content=generate))
        with patch.object(main, 'get_client', return_value=fake):
            response = self.client.post('/analytics', json={'records': [dict(timestamp='2026-09-19T16:00:00Z', is_correct=False, latex='xf(x)', summary='Review', error_clues=['Product rule'])]})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), result)
        self.assertIn('Product rule', generate.call_args.kwargs['contents'][0])


if __name__ == '__main__':
    unittest.main()
