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
        for asset in ('app.js', 'app.css', 'supabase-sync.js', 'onboarding.js', 'onboarding.css'):
            response = self.client.get('/static/' + asset)
            self.assertEqual(response.status_code, 200)
            self.assertGreater(len(response.content), 100)

    def test_new_accounts_receive_one_time_onboarding(self):
        sync_js = self.client.get('/static/supabase-sync.js').text
        onboarding_js = self.client.get('/static/onboarding.js').text
        self.assertIn('strive_new_account', sync_js)
        self.assertIn('strive_onboarding_complete', sync_js)
        self.assertIn('strive_onboarding_preferences', sync_js)
        self.assertIn('window.StriveOnboarding.start', sync_js)
        self.assertIn('Where are you in your math journey?', onboarding_js)
        self.assertIn('What are you studying right now?', onboarding_js)
        self.assertIn('Where do you usually get stuck?', onboarding_js)
        self.assertIn('How should your tutor help?', onboarding_js)
        self.assertIn('getLearnerProfile', sync_js)

    def test_desktop_auth_gate_keeps_login_dialog_visible(self):
        css = self.client.get('/static/app.css').text
        self.assertNotIn('.desktop-auth-pending #app {', css)
        self.assertIn('.desktop-auth-pending .tabbar', css)
        self.assertIn('.desktop-auth-pending #library', css)
        self.assertIn('.desktop-auth-pending #editor', css)

    def test_public_config_exposes_only_browser_safe_supabase_settings(self):
        with patch.dict('os.environ', {'SUPABASE_URL': 'https://example.supabase.co',
                                        'SUPABASE_PUBLISHABLE_KEY': 'sb_publishable_test'}, clear=False):
            response = self.client.get('/config')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['supabase_url'], 'https://example.supabase.co')
        self.assertEqual(response.json()['supabase_publishable_key'], 'sb_publishable_test')
        self.assertTrue(response.json()['supabase_enabled'])
        self.assertNotIn('service', response.text.lower())

    def test_static_production_client_uses_hosted_api_and_keeps_login_visible(self):
        index = self.client.get('/').text
        runtime = self.client.get('/static/runtime.js').text
        config = self.client.get('/static/desktop-config.js').text
        self.assertIn('id="accountButton" class="account-button" type="button">', index)
        self.assertIn('configured ||', runtime)
        self.assertIn('https://strive-api-ui0n.onrender.com', config)

    def test_supabase_migration_enforces_owner_rls(self):
        migration = (main.os.path.join(main.os.path.dirname(main.__file__), 'supabase', 'migrations',
                                       '202609190001_strive_notebook_sync.sql'))
        with open(migration, encoding='utf-8') as file:
            sql = file.read()
        self.assertIn('enable row level security', sql)
        self.assertIn('auth.uid()', sql)
        self.assertIn('to authenticated', sql)
        self.assertIn('revoke all', sql)

    def test_guest_and_new_account_workspaces_start_empty(self):
        app_js = self.client.get('/static/app.js').text
        sync_js = self.client.get('/static/supabase-sync.js').text
        self.assertIn('strive_guest_workspace_day_v1', app_js)
        self.assertIn('localStorage.removeItem(STORE)', app_js)
        self.assertNotIn('books = [\n      newBook("Calculus I"', app_js)
        self.assertIn('localState = readCache(userCacheKey(userId)) || { books: [], tabs: [] }', sync_js)
        self.assertIn('anonymous || { books: [], tabs: [] }', sync_js)

    def test_tutor_keeps_error_coordinates_and_latex_contract(self):
        result = dict(is_correct_so_far=False, status_message='Review this step.', correct_steps=[],
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
        result = dict(is_correct_so_far=True, status_message='A nudge for your next step.', correct_steps=[],
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
        result = dict(is_correct_so_far=True, status_message='A starting nudge.', correct_steps=[],
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

    def test_check_work_requests_correct_steps_alongside_errors(self):
        result = dict(is_correct_so_far=False, status_message='The setup is sound; review the final operation.',
                      correct_steps=[dict(step_label='Setup', explanation='You correctly rewrote the expression using $u=x^2$.')],
                      errors=[dict(problem_label='Final step', error_type='arithmetic',
                                   correction_message='Recheck the coefficient in the final simplification.',
                                   error_location_x=0.6, error_location_y=0.7)],
                      faint_hint=None, hint_location_x=None, hint_location_y=None,
                      current_latex=r'u=x^2')
        generate = unittest.mock.Mock(return_value=SimpleNamespace(text=json.dumps(result)))
        fake = SimpleNamespace(models=SimpleNamespace(generate_content=generate))
        with patch.object(main, 'get_client', return_value=fake):
            response = self.client.post('/tutor', json=dict(image_data='aW1hZ2U=', action_type='check_logic'))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['correct_steps'], result['correct_steps'])
        instruction = generate.call_args.kwargs['config'].system_instruction
        self.assertIn('even when a later or earlier step is wrong', instruction)
        self.assertIn('step-by-step breakdown', instruction)

    def test_walkthrough_returns_progressive_teaching_steps(self):
        result = dict(problem_summary='Complete the antiderivative using the power rule.',
                      steps=[dict(latex=r'\int 3x^2\,dx=x^3+C',
                                  goal='Find an antiderivative of $3x^2$.',
                                  reason='Reverse the power rule.',
                                  check='Differentiate $x^3+C$.',
                                  placement_x=0.55, placement_y=0.7)])
        generate = unittest.mock.Mock(return_value=SimpleNamespace(text=json.dumps(result)))
        fake = SimpleNamespace(models=SimpleNamespace(generate_content=generate))
        with patch.object(main, 'get_client', return_value=fake):
            response = self.client.post('/walkthrough', json=dict(image_data='aW1hZ2U=',
                                                                   action_type='get_hint', is_selection=True))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), result)
        instruction = generate.call_args.kwargs['config'].system_instruction
        self.assertIn('2 to 6 meaningful steps', instruction)
        self.assertIn('final answer', instruction)

    def test_marking_builds_a_question_specific_rubric(self):
        result = dict(
            questions=[dict(
                question_label='Question 1', question_type='Proof by induction',
                task_intent='Prove the statement for every positive integer.',
                rubric_basis='Estimated 8-mark induction rubric.',
                marks_awarded=6, marks_available=8,
                criteria=[dict(criterion='Base case', expectation='Verify the initial value.',
                               marks_available=1, marks_awarded=1),
                          dict(criterion='Inductive step', expectation='Use the hypothesis to prove the next case.',
                               marks_available=5, marks_awarded=3)],
                annotations=[dict(label='Inductive hypothesis', message='The hypothesis is stated correctly.',
                                  marks_delta=1, annotation_type='earned', location_x=0.4, location_y=0.45),
                             dict(label='Missing justification', message='Explain where the hypothesis is used.',
                                  marks_delta=-2, annotation_type='lost', location_x=0.55, location_y=0.65)],
                improvement_summary='Explicitly connect the hypothesis to the next case.',
                full_marks_latex=r'\text{Base case... Inductive step...}')],
            total_awarded=6, total_available=8,
            overall_feedback='The proof has the correct structure but an incomplete inductive step.',
            confidence_note='Estimated rubric; no instructor rubric was visible.')
        generate = unittest.mock.Mock(return_value=SimpleNamespace(text=json.dumps(result)))
        fake = SimpleNamespace(models=SimpleNamespace(generate_content=generate))
        with patch.object(main, 'get_client', return_value=fake):
            response = self.client.post('/marking', json=dict(image_data='aW1hZ2U=',
                                                               action_type='check_logic', is_selection=False))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), result)
        instruction = generate.call_args.kwargs['config'].system_instruction
        self.assertIn('separate marking scheme for EACH visible question', instruction)
        self.assertIn('follow-through marks', instruction)
        self.assertIn('full_marks_latex', instruction)

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
